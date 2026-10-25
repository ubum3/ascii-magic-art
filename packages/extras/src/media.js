/*
 * media.js: pixels to cells. Turns an RGBA buffer that is already the size of the
 * grid (one pixel per cell) into the { color, level } layers lib/image.js plays,
 * with a palette of at most 59 colours.
 *
 * Each pixel is split into a hue and a brightness: the hue, scaled up to full
 * brightness, picks a palette colour (median cut over every pixel), and the
 * brightness picks one of the eight lower blocks ▁..█, whose ink grows in eighths.
 * So 59 colours x 8 levels cover a photo well, and every look reads the shading back.
 *
 * Hosts decode and scale the picture themselves (sharp, ffmpeg, Go's image, Rust's
 * image crate) and hand over the small buffer.
 */
import { PICTURE_KEYS, toHex } from "./util.js";

/** Below this brightness (0..255) a pixel is empty: drawn in the background colour. */
const BLACK = 10;

function normalised(rgba, i) {
  const r = rgba[i], g = rgba[i + 1], b = rgba[i + 2], a = rgba[i + 3] === undefined ? 255 : rgba[i + 3];
  const v = Math.max(r, g, b) * (a / 255);
  if (v < BLACK) return null;
  const k = 255 / Math.max(r, g, b);
  return [r * k, g * k, b * k, v];
}

/**
 * A palette for one or more RGBA buffers: median cut on the full-brightness hues.
 * Returns hex colours, at most n (and at most 59).
 */
export function buildPalette(buffers, n = 48) {
  n = Math.max(1, Math.min(PICTURE_KEYS.length, n));
  const pts = [];
  for (const buf of buffers) {
    const step = Math.max(1, Math.floor(buf.length / 4 / 40000)); // sample at most ~40k pixels per buffer
    for (let i = 0; i < buf.length; i += 4 * step) {
      const p = normalised(buf, i);
      if (p) pts.push(p);
    }
  }
  if (!pts.length) return ["#ffffff"];
  let boxes = [pts];
  while (boxes.length < n) {
    // split the box with the widest channel range, at its median
    let best = -1, bi = -1, bc = 0;
    boxes.forEach((b, i) => {
      if (b.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let lo = 255, hi = 0;
        for (const p of b) { if (p[c] < lo) lo = p[c]; if (p[c] > hi) hi = p[c]; }
        const range = (hi - lo) * Math.sqrt(b.length);
        if (range > best) { best = range; bi = i; bc = c; }
      }
    });
    if (bi < 0 || best <= 0) break;
    const b = boxes[bi].map((p, i) => [p, i]);
    // ties broken by position, so every engine's sort gives the same split
    b.sort((x, y) => x[0][bc] - y[0][bc] || x[1] - y[1]);
    const mid = b.length >> 1;
    boxes.splice(bi, 1, b.slice(0, mid).map((x) => x[0]), b.slice(mid).map((x) => x[0]));
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const p of b) { s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; }
    return toHex(s.map((v) => v / b.length));
  });
}

/**
 * Map an RGBA buffer of w x h pixels to cells.
 *   opts.palette: hex colours to use (from buildPalette), so every frame of a clip shares one
 *   opts.colors:  how many colours to pick when no palette is given (default 48)
 *   opts.gamma:   brightness curve, below 1 lifts the darks (default 1)
 * Returns { cols, rows, palette, color: string[], level: string[] } for lib/image.js.
 */
export function cellsFromPixels(rgba, w, h, opts = {}) {
  const hexes = opts.palette || buildPalette([rgba], opts.colors || 48);
  const pal = hexes.map((hx) => [1, 3, 5].map((i) => parseInt(hx.slice(i, i + 2), 16)));
  const gamma = opts.gamma || 1;
  const cache = new Map();
  const nearest = (r, g, b) => {
    const q = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
    let k = cache.get(q);
    if (k !== undefined) return k;
    let bd = Infinity;
    for (let i = 0; i < pal.length; i++) {
      const dr = r - pal[i][0], dg = g - pal[i][1], db = b - pal[i][2];
      // weighted towards how the eye sees difference
      const d = 2 * dr * dr + 4 * dg * dg + 3 * db * db;
      if (d < bd) { bd = d; k = i; }
    }
    cache.set(q, k);
    return k;
  };
  const color = [], level = [];
  for (let y = 0; y < h; y++) {
    let cr = "", lr = "";
    for (let x = 0; x < w; x++) {
      const p = normalised(rgba, (x + y * w) * 4);
      if (!p) { cr += " "; lr += "0"; continue; }
      const v = Math.pow(p[3] / 255, gamma);
      cr += PICTURE_KEYS[nearest(p[0], p[1], p[2])];
      lr += String(Math.max(0, Math.min(7, Math.round(v * 8) - 1)));
    }
    color.push(cr); level.push(lr);
  }
  const palette = {};
  hexes.forEach((hx, i) => (palette[PICTURE_KEYS[i]] = hx));
  return { cols: w, rows: h, palette, color, level };
}

/** Cells to a still frame: the same glyphs lib/image.js draws, without motion. */
export function cellsFrame(cells) {
  const L = "▁▂▃▄▅▆▇█";
  const text = cells.level.map((lr, y) => [...lr].map((c, x) => (cells.color[y][x] === " " ? " " : L[c.charCodeAt(0) - 48])).join(""));
  return { text: text.join("\n"), color: cells.color.join("\n") };
}

/**
 * The grid size for a picture of pw x ph pixels at a given width in cells.
 * Square cells are one pixel each; text cells are about 1.66 times taller than wide.
 */
export function gridSize(pw, ph, cols, square = true) {
  const aspect = square ? 1 : 1 / 0.602;
  return [cols, Math.max(1, Math.round((ph / pw) * cols / aspect))];
}
