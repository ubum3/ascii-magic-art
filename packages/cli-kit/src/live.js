/*
 * live.js: a progress bar and a spinner on stderr, drawn by the extras
 * "progress" and "ticker" kinds at ~15 fps. They redraw in place, erase
 * themselves when they end and leave one line behind. Their timers are
 * unref'd, so they never keep a program alive. Don't write to the same
 * terminal while one runs: use .text() or .update() to change what it says.
 *
 *   const bar = progress({ label: "Uploading" });
 *   bar.update(0.4); ... bar.done("Uploaded");
 *   const s = spinner("Installing"); ... s.succeed("Installed");
 */
import process from "node:process";
import { fromSpec } from "ascii-magic-art-extras";
import { ansi, detectTruecolor } from "ascii-magic-art-studio/src/ansi.js";
import { mode as modeOf, colorOn } from "./mode.js";
import { HIDE, SHOW } from "./intro.js";

const FPS = 15;

// Redraws render(t) in place until end(): back up over the last lines, rewrite them, clear the rest.
function live(out, render) {
  let shown = 0, over = false, timer;
  const start = performance.now();
  const paint = () => {
    const lines = render((performance.now() - start) / 1000);
    out.write((shown ? `\x1b[${shown}F` : "") + lines.map((l) => `${l}\x1b[K\n`).join(""));
    shown = lines.length;
  };
  const restore = () => { try { out.write(SHOW); } catch {} };
  // Ctrl+C: put the terminal back, then let it do what it would have done.
  const interrupt = () => {
    end("");
    if (process.listenerCount("SIGINT") === 0) process.kill(process.pid, "SIGINT");
  };
  const end = (last) => {
    if (over) return;
    over = true;
    clearInterval(timer);
    process.off("exit", restore);
    process.off("SIGINT", interrupt);
    out.write((shown ? `\x1b[${shown}F\x1b[J` : "") + (last ? last + "\n" : "") + SHOW);
  };
  out.write(HIDE);
  paint();
  timer = setInterval(() => { try { paint(); } catch { end(""); } }, 1000 / FPS);
  timer.unref?.();
  process.on("exit", restore);
  process.on("SIGINT", interrupt);
  return { paint, end, get over() { return over; } };
}

const mark = (color, ok) => (color ? (ok ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m") : ok ? "✓" : "✗");

/**
 * A bar that eases to its value. update(value 0..1, label?), done(message?).
 * Not on a terminal (or under CI) it logs a line as it passes each quarter, and one when done.
 */
export function progress({ label = "", cols, out = process.stderr, env = process.env } = {}) {
  const state = { value: 0, label };
  if (modeOf(out, env) === "plain") {
    let quarter = 0;
    return {
      update(value, l) {
        if (l != null) state.label = l;
        state.value = Math.max(0, Math.min(1, Number(value) || 0));
        const q = Math.floor(state.value * 4);
        if (q > quarter && q < 4) { quarter = q; out.write(`${state.label ? state.label + " " : ""}${q * 25}%\n`); }
      },
      done(message) { out.write(`${mark(false, true)} ${message ?? (state.label || "done")}\n`); },
    };
  }
  const color = colorOn(env);
  const W = Math.max(10, Math.min(cols || 40, (out.columns || 80) - 1));
  const p = fromSpec({ kind: "progress", cols: W, rows: 2, label });
  const draw = p.default(), r = ansi({ color, truecolor: detectTruecolor() });
  const l = live(out, (t) => r.lines(draw(t, state), p.meta));
  return {
    update(value, lbl) {
      if (lbl != null) state.label = lbl;
      state.value = Math.max(0, Math.min(1, Number(value) || 0));
    },
    done(message) { l.end(`${mark(color, true)} ${message ?? (state.label || "done")}`); },
  };
}

/**
 * An indeterminate line: a strip of the extras "ticker" kind scrolling, then the label.
 * text(label), succeed(message?), fail(message?). Not on a terminal it logs the label once and the result.
 */
export function spinner(label = "", { out = process.stderr, env = process.env } = {}) {
  let text = label;
  if (modeOf(out, env) === "plain") {
    if (text) out.write(`${text}…\n`);
    return {
      text(s) { text = s; },
      succeed(s) { out.write(`${mark(false, true)} ${s ?? text}\n`); },
      fail(s) { out.write(`${mark(false, false)} ${s ?? text}\n`); },
    };
  }
  const color = colorOn(env);
  const p = fromSpec({ kind: "ticker", cols: 10, items: [{ label: "━━━" }], speed: 14 });
  const draw = p.default(), r = ansi({ color, truecolor: detectTruecolor() });
  const width = (out.columns || 80) - 1;
  // one row, the label cut to fit, so it never wraps and the redraw always lands on it
  const l = live(out, (t) => [`${r.lines(draw(t), p.meta)[0]} ${[...String(text)].slice(0, Math.max(0, width - 11)).join("")}`]);
  return {
    text(s) { text = s; },
    succeed(s) { l.end(`${mark(color, true)} ${s ?? text}`); },
    fail(s) { l.end(`${mark(color, false)} ${s ?? text}`); },
  };
}
