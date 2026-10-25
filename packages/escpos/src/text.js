/*
 * text.js: a frame as lines of CP437 text for text mode.
 *
 * A frame that already fits the paper and is all CP437 (half-block pictures,
 * QR codes, box drawing, plain text) prints as it is. Anything else is resampled
 * to the paper's columns and shaded: each cell's darkness (densityGrid in
 * runtime/glyphs.js: ink coverage x colour brightness) becomes one of " ░▒▓█".
 *
 * Ink follows the screen: what is bright on a dark screen is inked on paper.
 * invert swaps that (a QR code, whose frame inks the light modules, needs it).
 */
import { densityGrid } from "ascii-magic-art/runtime/glyphs.js";
import { encodable } from "./cp437.js";

export const SHADES = " ░▒▓█";
const FLIP = { " ": "█", "█": " ", "▀": "▄", "▄": "▀", "▌": "▐", "▐": "▌", "░": "▓", "▓": "░" };

/** Swap ink and paper in a frame of blocks and shades; other characters stay. */
export const invertText = (rows) => rows.map((r) => [...r].map((ch) => FLIP[ch] ?? ch).join(""));

/**
 * A frame to rows of text at most `cols` wide.
 *   cellAspect: how much taller than wide a source cell is (1/0.602 for text pieces, 1 for square)
 *   fontAspect: the same for the printer font (24/12 for font A, 17/9 for B)
 *   shade: force shading even when the frame could print as it is
 */
export function textRows(frame, palette, { cols, cellAspect = 1 / 0.602, fontAspect = 2, shade = false, invert = false } = {}) {
  const T = (typeof frame === "string" ? frame : frame.text).split("\n");
  const w = Math.max(...T.map((r) => [...r].length));
  let rows;
  if (!shade && w <= cols && T.every(encodable)) rows = T.map((r) => r.padEnd(w, " "));
  else rows = shadeRows(frame, palette, { cols: Math.min(cols, w), cellAspect, fontAspect });
  return invert ? invertText(rows) : rows;
}

function shadeRows(frame, palette, { cols, cellAspect, fontAspect }) {
  const { D, w, h } = densityGrid(frame, palette, { all: true });
  const k = w / cols;
  const H = Math.max(1, Math.round((h / k) * (cellAspect / fontAspect)));
  const out = [];
  for (let y = 0; y < H; y++) {
    const y0 = Math.floor((y * h) / H), y1 = Math.max(y0 + 1, Math.floor(((y + 1) * h) / H));
    let r = "";
    for (let x = 0; x < cols; x++) {
      const x0 = Math.floor((x * w) / cols), x1 = Math.max(x0 + 1, Math.floor(((x + 1) * w) / cols));
      let sum = 0, n = 0;
      for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const d = D[yy][xx]; sum += d > 0 ? d : 0; n++; }
      // densityGrid lifts the darks (gamma 0.35) for screens; paper wants them back down
      const d = n ? Math.pow(sum / n, 1.8) : 0;
      r += d < 0.06 ? " " : SHADES[Math.min(4, 1 + Math.floor(d * 4))];
    }
    out.push(r);
  }
  return out;
}
