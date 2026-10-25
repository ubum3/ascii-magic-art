/*
 * intro.js: a piece, a spec or a few words printed where the cursor is, as a CLI
 * starts. It moves once, in place, and stays in the scrollback with the rest of
 * the output. The scrollback model is ported from ascii.rest's print.ts
 * (banner(), by @bas3line, MIT): print the rows, then go back up over them with
 * \x1b[nF and rewrite each one, and show the cursor again however it ends.
 *
 *   import { intro } from "ascii-magic-art-cli-kit";
 *   await intro("my-cli", { tagline: "v1.0" });
 */
import process from "node:process";
import { ansi, detectTruecolor, termSize } from "ascii-magic-art-studio/src/ansi.js";
import { mode as modeOf, colorOn } from "./mode.js";
import { resolve } from "./source.js";

export const HIDE = "\x1b[?25l", SHOW = "\x1b[?25h";

/**
 * Prints it and resolves once it has moved, with { cols, rows, mode, interrupted }. Piped, under CI, with TERM=dumb or
 * AMA_NO_INTRO it prints its words and the tagline and no escape codes. A terminal too narrow for it gets the words, one
 * too short gets one still frame, and one resized while it moves stops it where it is. Ctrl+C ends the motion, not the
 * program. It throws when `seconds` is not 0 or more.
 */
export async function intro(src, { seconds, tagline = "", out = process.stdout, state, env = process.env } = {}) {
  if (seconds !== undefined && (!Number.isFinite(seconds) || seconds < 0)) throw new Error(`cli-kit: seconds takes a number of 0 or more, not ${seconds}`);
  const p = await resolve(src);
  const mode = modeOf(out, env);
  const result = { cols: 0, rows: 0, mode: "plain", interrupted: false };
  if (mode === "plain") {
    out.write(`${p.words}\n${tagline ? tagline + "\n" : ""}`);
    return result;
  }
  const color = colorOn(env);
  const under = tagline ? (color ? `\x1b[2m${tagline}\x1b[0m\n` : `${tagline}\n`) : "";
  // A column short of the width: a row that fills it leaves the cursor on its last column, and \x1b[K would clear it.
  const width = (out.columns || 80) - 1;
  const [cols, rows] = termSize(p.meta);
  if (cols > width) {
    out.write(`${p.words}\n${under}`);
    return result;
  }
  const r = ansi({ color, truecolor: detectTruecolor() });
  const lines = (t) => r.lines(p.draw(t, state), p.meta);
  const dur = seconds ?? p.seconds;
  Object.assign(result, { cols, rows });
  // It moves by going back up over its own rows, so a terminal too short to show them all gets the still.
  const room = !out.rows || out.rows > rows + 1;
  if (mode === "static" || dur === 0 || !room) {
    out.write(lines(dur).join("\n") + "\n" + under);
    result.mode = "static";
    return result;
  }
  result.mode = "anim";
  const fps = Math.min(p.meta.fps || 30, 30);

  return new Promise((done, fail) => {
    let shown = lines(0), timer, over = false;
    const draw = (next) => {
      if (next.every((line, i) => line === shown[i])) return;
      out.write(`\x1b[${shown.length}F` + next.map((line) => `${line}\x1b[K\n`).join(""));
      shown = next;
    };
    const listens = typeof out.on === "function" && typeof out.off === "function";
    const stop = (error) => {
      if (over) return;
      over = true;
      clearInterval(timer);
      process.off("SIGINT", interrupt);
      process.off("exit", restore);
      if (listens) out.off("resize", resize);
      try {
        if (!error) out.write(under);
        out.write(SHOW);
      } catch (late) {
        error ??= { error: late };
      }
      if (error) fail(error.error);
      else done(result);
    };
    // A write that throws, to a closed stream say, ends it: the timer and the listeners go, and the call rejects.
    const safely = (fn) => {
      try { fn(); } catch (error) { stop({ error }); }
    };
    const finish = () => safely(() => (draw(lines(dur)), stop()));
    const interrupt = () => ((result.interrupted = true), finish());
    const resize = () => stop();
    const restore = () => { try { out.write(SHOW); } catch {} };
    process.on("SIGINT", interrupt);
    process.on("exit", restore);
    if (listens) out.on("resize", resize);
    safely(() => out.write(HIDE + shown.map((line) => `${line}\n`).join("")));
    if (over) return;
    const start = performance.now();
    timer = setInterval(() => safely(() => {
      const t = (performance.now() - start) / 1000;
      if (t >= dur) return finish();
      draw(lines(t));
    }), 1000 / fps);
  });
}
