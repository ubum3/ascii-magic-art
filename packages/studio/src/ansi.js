/*
 * ansi.js: frames as terminal text. The same rules as bin/cli.js: 24-bit colour
 * where the terminal supports it, else the nearest of the 256 standard colours;
 * square-cell pictures as half blocks, two pixels per character.
 */
const env = process.env;
export const detectTruecolor = () => /truecolor|24bit/i.test(env.COLORTERM || "") || env.FORCE_COLOR === "3" || !!env.WT_SESSION ||
  (env.TERM_PROGRAM !== "Apple_Terminal" && /iTerm|WezTerm|vscode|ghostty|Hyper|Tabby|WarpTerminal|rio|kitty|alacritty|foot/i.test(env.TERM_PROGRAM || env.TERM || ""));

const XLV = [0, 95, 135, 175, 215, 255], X256 = [];
for (let n = 16; n < 256; n++) X256.push([n, ...(n >= 232 ? [8 + (n - 232) * 10, 8 + (n - 232) * 10, 8 + (n - 232) * 10] : [XLV[Math.floor((n - 16) / 36)], XLV[Math.floor((n - 16) / 6) % 6], XLV[(n - 16) % 6]])]);
const near = new Map();
export function to256(r, g, b) {
  const key = (r << 16) | (g << 8) | b;
  let best = near.get(key);
  if (best !== undefined) return best;
  let bd = Infinity;
  for (const [n, R, G, B] of X256) {
    const rm = (r + R) / 2, d = (2 + rm / 256) * (r - R) ** 2 + 4 * (g - G) ** 2 + (2 + (255 - rm) / 256) * (b - B) ** 2;
    if (d < bd) { bd = d; best = n; }
  }
  near.set(key, best);
  return best;
}
export const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));

/**
 * A renderer for one colour setting: { color: bool, truecolor: bool }.
 * lines(frame, meta, w, h) gives the terminal lines, cropped (text pieces) or
 * sampled down (square pictures) to fit w x h.
 */
export function ansi({ color = true, truecolor = detectTruecolor() } = {}) {
  const fg = ([r, g, b]) => (truecolor ? `\x1b[38;2;${r};${g};${b}m` : `\x1b[38;5;${to256(r, g, b)}m`);
  const bg = ([r, g, b]) => (truecolor ? `\x1b[48;2;${r};${g};${b}m` : `\x1b[48;5;${to256(r, g, b)}m`);
  const row = (t, c, pal) => {
    if (!color || !c) return t.join("");
    let s = "", key = null;
    for (let x = 0; x < t.length; x++) {
      if (c[x] !== key) { key = c[x]; const hex = key !== " " && pal && pal[key]; s += hex ? fg(rgb(hex)) : "\x1b[39m"; }
      s += t[x];
    }
    return s + "\x1b[0m";
  };
  const LEVEL = { "▁": 0.14, "▂": 0.26, "▃": 0.38, "▄": 0.51, "▅": 0.64, "▆": 0.76, "▇": 0.88, "█": 1, "░": 0.3, "▒": 0.55, "▓": 0.8 };
  const half = (frame, pal, k) => {
    const T = frame.text.split("\n").map((r) => [...r]), C = frame.color.split("\n").map((r) => [...r]);
    const px = (y, x) => {
      const key = C[y] && C[y][x];
      if (!key || key === " " || !pal[key] || T[y][x] === " ") return [0, 0, 0];
      const f = Math.min(1, (LEVEL[T[y][x]] ?? 0.8) * 1.25);
      return rgb(pal[key]).map((v) => Math.round(v * f));
    };
    const out = [];
    for (let y = 0; y < T.length; y += 2 * k) {
      let line = "";
      for (let x = 0; x < T[0].length; x += k) line += `${fg(px(y, x))}${bg(px(y + k, x))}▀`;
      out.push(line + "\x1b[0m");
    }
    return out;
  };
  return {
    fg, bg,
    lines(frame, meta, w = Infinity, h = Infinity) {
      if (typeof frame === "string") frame = { text: frame, color: null };
      const pal = frame.palette || meta.palette;
      if (meta.cell === "square" && color && frame.color) {
        const k = Math.max(1, Math.ceil(meta.cols / w), Math.ceil(meta.rows / (2 * h)));
        return half(frame, pal, k);
      }
      const T = frame.text.split("\n").map((r) => [...r]), C = frame.color ? frame.color.split("\n").map((r) => [...r]) : null;
      const rows = Math.min(T.length, h), cols = Math.min(T[0].length, w);
      const y0 = Math.floor((T.length - rows) / 2), x0 = Math.floor((T[0].length - cols) / 2);
      const out = [];
      for (let y = y0; y < y0 + rows; y++) out.push(row(T[y].slice(x0, x0 + cols), C && C[y] && C[y].slice(x0, x0 + cols), pal));
      return out;
    },
  };
}

/** The size a frame takes in a terminal: square pictures use half as many lines. */
export const termSize = (meta) => [meta.cols, meta.cell === "square" ? Math.ceil(meta.rows / 2) : meta.rows];
