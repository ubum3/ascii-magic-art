/*
 * receipt.js: a piece (or a spec, clip or piece module) to an ESC/POS job.
 *
 *   const bytes = await receipt("spinning-coin", { paper: 80, mode: "raster" });
 *   const book = await flipbook("rocket-launch", { frames: 8, every: 0.25 });
 *   const code = await qrReceipt("https://pay.example/r/42", { native: true });
 */
import { load } from "ascii-magic-art-studio/src/load.js";
import { qrPiece } from "ascii-magic-art-qr";
import { Job, start, align, line, feed, cut, raster, nativeQr, bold, PAPER, FONTS } from "./encode.js";
import { textRows } from "./text.js";
import { rasterFrame } from "./raster.js";

export const MODES = ["text", "raster"];

const paperOf = (p) => {
  const paper = PAPER[p];
  if (!paper) throw new Error(`escpos: paper must be 58 or 80 (mm), not ${JSON.stringify(p)}`);
  return paper;
};

/** Anything load() takes, or an already loaded { meta, draw }. */
async function source(src, look) {
  if (src && typeof src === "object" && typeof src.draw === "function") return src;
  if (src && typeof src === "object" && typeof src.default === "function") return { meta: src.meta, draw: src.default() };
  return load(src, look);
}

/** One frame's commands into a job. */
async function frameInto(job, piece, t, o) {
  const { meta, draw } = piece;
  const f = draw(t, o.state);
  const paper = paperOf(o.paper);
  if (o.mode === "raster") {
    const img = await rasterFrame(f, meta, { dots: paper.dots, method: o.dither, ink: o.ink, invert: o.invert });
    job.add(align("centre"), raster(img.bits, img.widthBytes, img.height));
  } else {
    const [cw, ch] = FONTS[o.font];
    const rows = textRows(f, (typeof f === "object" && f.palette) || meta.palette, {
      cols: paper[o.font], cellAspect: meta.cell === "square" ? 1 : 1 / 0.602, fontAspect: ch / cw, shade: o.shade, invert: o.invert,
    });
    job.add(align("centre"));
    for (const r of rows) job.add(line(r));
  }
}

const defaults = (o) => ({ paper: 58, font: "a", mode: "text", dither: "floyd", ink: 0.6, invert: false, shade: false, cut: true, ...o });

/**
 * One frame of a piece as a job (Uint8Array).
 *   paper 58|80, font "a"|"b", mode "text"|"raster", at (seconds, default 1.5 or 0 for stills),
 *   dither "floyd"|"bayer"|"threshold", ink (0..1, raster), invert, shade (text), title, cut, look, state
 */
export async function receipt(src, opts = {}) {
  const o = defaults(opts);
  if (!MODES.includes(o.mode)) throw new Error(`escpos: mode must be text or raster, not ${JSON.stringify(o.mode)}`);
  const piece = await source(src, o.look);
  const job = start(new Job(), { fontName: o.font });
  if (o.title) job.add(align("centre"), bold(true), line(o.title), bold(false));
  await frameInto(job, piece, o.at ?? (piece.meta.still ? 0 : 1.5), o);
  job.add(feed(3));
  if (o.cut) job.add(cut());
  return job.bytes();
}

/**
 * N frames one after another, each with its number under it and a partial cut
 * (or a dashed rule with cut: false), to staple into a flipbook.
 *   frames (default 8), every (seconds between frames, default 1 / 8), from (first time, default 0)
 */
export async function flipbook(src, opts = {}) {
  const o = defaults(opts);
  const n = Math.max(1, o.frames | 0 || 8), every = o.every > 0 ? o.every : 1 / 8, from = o.from || 0;
  const piece = await source(src, o.look);
  const job = start(new Job(), { fontName: o.font });
  const width = paperOf(o.paper)[o.font];
  for (let i = 0; i < n; i++) {
    await frameInto(job, piece, from + i * every, o);
    job.add(align("centre"), line(`${i + 1}/${n}`));
    if (o.cut) job.add(feed(2), cut());
    else job.add(line("- ".repeat(width >> 1).trimEnd()));
  }
  job.add(feed(3));
  return job.bytes();
}

/**
 * A QR code receipt. native: the printer's own GS ( k command (sharpest; the
 * printer draws it). Otherwise the settled ascii-magic-art-qr code, in text
 * mode (half blocks in CP437) or raster mode, inverted so the dark modules are
 * inked and the paper is the quiet zone.
 */
export async function qrReceipt(text, opts = {}) {
  const o = defaults(opts);
  const q = o.native ? null : qrPiece(text, { ecc: o.ecc, still: true, warn: false });
  if (q && o.mode === "text") {
    // whole modules only: font B when font A is too narrow, raster when both are
    const paper = paperOf(o.paper);
    if (paper[o.font] < q.meta.cols) { if (paper.b >= q.meta.cols) o.font = "b"; else o.mode = "raster"; }
  }
  const job = start(new Job(), { fontName: o.font });
  if (o.title) job.add(align("centre"), bold(true), line(o.title), bold(false));
  if (o.native) {
    job.add(align("centre"), nativeQr(text, { size: o.size || (o.paper === 80 ? 8 : 6), ecc: o.ecc }));
  } else {
    await frameInto(job, { meta: q.meta, draw: q.default() }, 0, { ...o, invert: true, ink: 1, dither: "threshold", shade: false });
  }
  if (o.caption) job.add(align("centre"), line(o.caption));
  job.add(feed(3));
  if (o.cut) job.add(cut());
  return job.bytes();
}
