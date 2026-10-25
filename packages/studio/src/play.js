/*
 * play.js: play anything in the terminal until a key, or for --seconds. Fits
 * the window, follows resizes, and leaves the terminal as it found it.
 */
import { ansi, detectTruecolor } from "./ansi.js";

export async function play(src, { seconds, state, frame: still, at = 1.5 } = {}) {
  const out = process.stdout;
  const color = (out.isTTY || process.env.FORCE_COLOR) && process.env.NO_COLOR === undefined;
  const r = ansi({ color, truecolor: detectTruecolor() });
  const { meta, draw } = src;
  if (still || !out.isTTY) {
    out.write(r.lines(draw(meta.still ? 0 : at, state), meta, out.columns || Infinity, out.rows || Infinity).join("\n") + "\n");
    return;
  }
  out.write("\x1b[?1049h\x1b[?25l");
  const restore = () => out.write("\x1b[0m\x1b[?25h\x1b[?1049l");
  let stop = false;
  const end = () => { stop = true; };
  process.stdin.isTTY && process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.once("data", end);
  process.on("SIGINT", end);
  const start = Date.now(), fps = Math.min(meta.fps || 24, 60);
  try {
    while (!stop) {
      const t = (Date.now() - start) / 1000;
      if (seconds && t >= seconds) break;
      const W = out.columns || 80, H = out.rows || 24;
      const lines = r.lines(draw(t, state), meta, W, H);
      const top = Math.max(0, Math.floor((H - lines.length) / 2));
      const pad = " ".repeat(Math.max(0, Math.floor((W - visible(lines[0] || "")) / 2)));
      out.write("\x1b[H\x1b[2J" + "\n".repeat(top) + lines.map((l) => pad + l).join("\n"));
      await new Promise((res) => setTimeout(res, 1000 / fps));
    }
  } finally {
    restore();
    process.stdin.isTTY && process.stdin.setRawMode(false);
    process.stdin.pause();
  }
}

const visible = (s) => [...s.replace(/\x1b\[[0-9;]*m/g, "")].length;
