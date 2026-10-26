/*
 * raster.js: pictures and logos to specs, with sharp (which draws SVG with librsvg).
 *
 *   imageSpec(file, opts)  a photo or drawing -> { kind: "image", ... }
 *   brandSpec(file, opts)  a logo (SVG or PNG with transparency) -> { kind: "brand", ... }
 */
import sharp from "sharp";
import { cellsFromPixels, gridSize } from "ascii-magic-art-extras";

const TEXT_ASPECT = 1 / 0.602; // a text cell is this many times taller than wide

const MAX_SIDE = 4096; // largest SVG render, in px: big viewBoxes would pass sharp's pixel limit

/** Render at a size that keeps vector input sharp, capped at MAX_SIDE on its longest side. */
async function input(file, density) {
  const isSvg = /\.svg$/i.test(file) || (Buffer.isBuffer(file) && file.slice(0, 256).toString().includes("<svg"));
  if (!isSvg) return sharp(file);
  const { width = 0, height = 0 } = await sharp(file).metadata(); // at 72 dpi
  const side = (Math.max(width, height) * density) / 72;
  return sharp(file, { density: side > MAX_SIDE ? (density * MAX_SIDE) / side : density });
}

export async function imageSpec(file, { cols = 96, rows, square = true, colors = 48, gamma = 1, motion, look, fps, name } = {}) {
  const img = await input(file, 300);
  const { width, height } = await img.metadata();
  const [c, r] = rows ? [cols, rows] : gridSize(width, height, cols, square);
  const { data } = await img.resize(c, r, { fit: rows ? "cover" : "fill", kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const cells = cellsFromPixels(data, c, r, { colors, gamma });
  return { kind: "image", name, ...cells, square, ...(motion ? { motion } : {}), ...(look ? { look } : {}), ...(fps ? { fps } : {}) };
}

/** The colours a logo is drawn in: the most common ones, near-duplicates merged. */
function logoColours(samples, n) {
  const hist = new Map();
  for (const [r, g, b, w] of samples) {
    const q = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const e = hist.get(q) || [0, 0, 0, 0];
    e[0] += r * w; e[1] += g * w; e[2] += b * w; e[3] += w;
    hist.set(q, e);
  }
  const bins = [...hist.values()].map((e) => [e[0] / e[3], e[1] / e[3], e[2] / e[3], e[3]]).sort((a, b) => b[3] - a[3]);
  const out = [];
  for (const c of bins) {
    if (out.length >= n) break;
    if (out.every((o) => (o[0] - c[0]) ** 2 + (o[1] - c[1]) ** 2 + (o[2] - c[2]) ** 2 > 45 * 45)) out.push(c);
  }
  return out.length ? out : [[255, 255, 255, 1]];
}

const hex = (c) => "#" + c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

/**
 * A logo mask. The logo is trimmed, fitted into cols x rows (rows from its shape
 * when not given) with a cell of padding, drawn at 4 x 7 samples per text cell
 * (4 x 4 for square cells), and each cell gets its coverage 0-8 and the nearest
 * of its main colours. colors: hex colours that replace the logo's own, in order
 * of how much of the logo they cover. background: a colour to treat as empty, for
 * PNGs without transparency (default: the corner colour when the corners are opaque).
 *
 * style "glyphs" draws the logo the way ascii.rest draws its logos: each cell is
 * the character whose shape best matches the logo's edge through it (/ \ ( ) d b
 * and so on), 8 where it is solid. The effects play as before and settle on those
 * characters (spec.chars).
 */
export async function brandSpec(file, opts = {}) {
  if (opts.style === "glyphs") return glyphBrandSpec(file, opts);
  if (opts.style && opts.style !== "blocks") throw new Error(`no style "${opts.style}": blocks, glyphs`);
  return blockBrandSpec(file, opts);
}

async function blockBrandSpec(file, { cols = 60, rows, square = false, effect = "reveal", idle, duration, loop, colors, maxColors = 8, padding = 1, background, name, look } = {}) {
  const sx = 4, sy = square ? 4 : 7;
  // Opaque PNG: when all four corners are the same opaque colour, that is the background.
  let bgc = background ? [1, 3, 5].map((i) => parseInt(background.slice(i, i + 2), 16)) : null;
  if (!bgc) {
    const { data: d, info: n } = await (await input(file, 72)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => [...d.subarray((y * n.width + x) * 4, (y * n.width + x) * 4 + 4)];
    const corners = [at(0, 0), at(n.width - 1, 0), at(0, n.height - 1), at(n.width - 1, n.height - 1)];
    const same = corners.every((c) => c[3] > 250 && Math.hypot(c[0] - corners[0][0], c[1] - corners[0][1], c[2] - corners[0][2]) < 24);
    if (same) bgc = corners[0].slice(0, 3);
  }
  const trimmed = await (await input(file, 600)).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
  const { width, height } = await sharp(trimmed).metadata();
  const inner = cols - padding * 2;
  const aspect = square ? 1 : TEXT_ASPECT;
  if (!rows) rows = Math.max(3, Math.round((height / width) * inner / aspect) + padding * 2);
  const innerRows = rows - padding * 2;
  const { data, info } = await sharp(trimmed)
    .resize(inner * sx, innerRows * sy, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 }, kernel: "lanczos3" })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const alpha = (i) => {
    let a = data[i + 3] / 255;
    if (bgc) {
      const d = Math.hypot(data[i] - bgc[0], data[i + 1] - bgc[1], data[i + 2] - bgc[2]);
      a *= Math.min(1, d / 60);
    }
    return a;
  };
  const cellCov = [], cellCol = [], samples = [];
  for (let y = 0; y < innerRows; y++) for (let x = 0; x < inner; x++) {
    let a = 0, r = 0, g = 0, b = 0;
    for (let j = 0; j < sy; j++) for (let i = 0; i < sx; i++) {
      const p = ((y * sy + j) * W + x * sx + i) * 4, w = alpha(p);
      a += w; r += data[p] * w; g += data[p + 1] * w; b += data[p + 2] * w;
    }
    const cov = Math.round((a / (sx * sy)) * 8);
    cellCov.push(cov);
    const c = a > 0 ? [r / a, g / a, b / a] : [0, 0, 0];
    cellCol.push(c);
    if (cov) samples.push([...c, a]);
  }
  const main = logoColours(samples, maxColors);
  const palette = {};
  main.forEach((c, i) => (palette[String(i)] = colors && colors[i] ? colors[i] : hex(c)));
  const nearest = (c) => {
    let best = 0, bd = Infinity;
    main.forEach((m, i) => { const d = (m[0] - c[0]) ** 2 + (m[1] - c[1]) ** 2 + (m[2] - c[2]) ** 2; if (d < bd) { bd = d; best = i; } });
    return String(best);
  };
  const cov = [], color = [];
  for (let y = 0; y < rows; y++) {
    let cr = "", kr = "";
    for (let x = 0; x < cols; x++) {
      const ix = x - padding, iy = y - padding;
      const n = ix >= 0 && iy >= 0 && ix < inner && iy < innerRows ? ix + iy * inner : -1;
      const c = n >= 0 ? cellCov[n] : 0;
      cr += c; kr += c ? nearest(cellCol[n]) : " ";
    }
    cov.push(cr); color.push(kr);
  }
  return {
    kind: "brand", name, effect, cols, rows, palette, cov, color, square,
    ...(idle ? { idle } : {}), ...(duration ? { duration } : {}), ...(loop ? { loop } : {}), ...(look ? { look } : {}),
  };
}

/*
 * ascii.rest measures its glyphs on cells twice as tall as wide; ours are 1/0.602
 * tall. Stretching the picture by the difference keeps the logo's shape.
 */
const REST_STRETCH = 2 * 0.602;

async function glyphBrandSpec(file, { cols = 60, rows, effect = "reveal", idle, duration, loop, colors, name, look } = {}) {
  const { drawing } = await import("ascii-magic-art-rest");
  const img = await input(file, 600);
  const { width, height } = await img.metadata();
  const w = Math.min(2400, cols * 24), h = Math.max(1, Math.round((height / width) * w * (1 / REST_STRETCH)));
  const { data, info } = await img.resize(w, h, { fit: "fill", kernel: "lanczos3" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const d = drawing(new Uint8Array(data.buffer, data.byteOffset, data.length), info.width, info.height, {
    style: "logo", width: cols, ...(rows ? { height: rows } : {}), color: true,
  });
  const palette = {};
  d.colors.forEach((c, i) => (palette[String(i)] = colors && colors[i] ? colors[i] : hex(c)));
  const pad = (row) => row.padEnd(d.cols).slice(0, d.cols);
  const chars = d.art.map(pad), ink = d.ink.map(pad);
  // Coverage, for the effects that shade by it: solid cells are 8, edge glyphs half.
  const cov = chars.map((r) => [...r].map((ch) => (ch === " " ? 0 : ch === "8" ? 8 : 4)).join(""));
  const color = chars.map((r, y) => [...r].map((ch, x) => (ch === " " ? " " : String(parseInt(ink[y][x], 36) || 0))).join(""));
  return {
    kind: "brand", name, effect, cols: d.cols, rows: d.rows, palette, cov, color, chars, square: false,
    ...(idle ? { idle } : {}), ...(duration ? { duration } : {}), ...(loop ? { loop } : {}), ...(look ? { look } : {}),
  };
}
