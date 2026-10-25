/*
 * encode.js: ESC/POS commands as byte arrays, and Job, which strings them
 * together. Only commands every Epson-compatible receipt printer knows.
 *
 *   ESC @        1B 40              initialise
 *   FS .         1C 2E              cancel Kanji mode (clones often boot in GB18030)
 *   ESC t n      1B 74 n            code page (0 = CP437)
 *   ESC a n      1B 61 n            align: 0 left, 1 centre, 2 right
 *   ESC M n      1B 4D n            font: 0 = A (12x24 dots), 1 = B (9x17)
 *   ESC E n      1B 45 n            bold
 *   ESC 3 n      1B 33 n            line spacing n dots (ESC 2 = default, 30)
 *   ESC d n      1B 64 n            feed n lines
 *   GS v 0       1D 76 30 m xL xH yL yH d...   raster image, in bands of at most 255 rows
 *   GS ( k       1D 28 6B ...       the printer's own QR code (model 2)
 *   GS V 66 n    1D 56 42 n         feed n and cut (partial; 65 is a full cut)
 */
import { encode } from "./cp437.js";

export const ESC = 0x1b, GS = 0x1d, FS = 0x1c, LF = 0x0a;

/** Paper widths: printable dots, and columns in font A (12 dots) and font B (9 dots). */
export const PAPER = {
  58: { dots: 384, a: 32, b: 42 },
  80: { dots: 576, a: 48, b: 64 },
};
/** Font cells in dots: width, height. */
export const FONTS = { a: [12, 24], b: [9, 17] };

export const init = () => [ESC, 0x40];
export const cancelKanji = () => [FS, 0x2e];
export const codePage = (n = 0) => [ESC, 0x74, n];
export const align = (where) => [ESC, 0x61, { left: 0, centre: 1, center: 1, right: 2 }[where] ?? where];
export const font = (f) => [ESC, 0x4d, f === "b" ? 1 : 0];
export const bold = (on = true) => [ESC, 0x45, on ? 1 : 0];
export const lineSpacing = (dots) => (dots == null ? [ESC, 0x32] : [ESC, 0x33, dots]);
export const feed = (lines = 1) => [ESC, 0x64, lines];
export const cut = ({ partial = true, feed: n = 0 } = {}) => [GS, 0x56, partial ? 66 : 65, n];
/** A line of text in CP437, then LF. */
export const line = (s = "") => [...encode(s), LF];

/**
 * A 1-bit image as GS v 0 commands. bits holds rows of widthBytes bytes, MSB is
 * the leftmost dot, 1 is ink. Split into bands of at most 255 rows, which every
 * printer's buffer takes.
 */
export function raster(bits, widthBytes, height, band = 255) {
  const out = [];
  for (let y = 0; y < height; y += band) {
    const h = Math.min(band, height - y);
    out.push(GS, 0x76, 0x30, 0, widthBytes & 255, widthBytes >> 8, h & 255, h >> 8);
    for (let i = y * widthBytes; i < (y + h) * widthBytes; i++) out.push(bits[i]);
  }
  return out;
}

const QR_ECC = { L: 48, M: 49, Q: 50, H: 51 };
/** The printer's own QR code (GS ( k, model 2): module size 1-16 dots, ECC L/M/Q/H. */
export function nativeQr(text, { size = 6, ecc = "M" } = {}) {
  const data = [...new TextEncoder().encode(text)];
  const n = data.length + 3;
  if (n > 7092) throw new Error("escpos: QR data too long");
  return [
    GS, 0x28, 0x6b, 4, 0, 49, 65, 50, 0, // model 2
    GS, 0x28, 0x6b, 3, 0, 49, 67, Math.max(1, Math.min(16, size)), // module size
    GS, 0x28, 0x6b, 3, 0, 49, 69, QR_ECC[ecc] ?? QR_ECC.M, // error correction
    GS, 0x28, 0x6b, n & 255, n >> 8, 49, 80, 48, ...data, // store
    GS, 0x28, 0x6b, 3, 0, 49, 81, 48, // print
  ];
}

/** Commands collected in order; bytes() is the job to send. */
export class Job {
  constructor() { this.parts = []; }
  add(...cmds) { for (const c of cmds) this.parts.push(c); return this; }
  bytes() {
    let n = 0;
    for (const p of this.parts) n += p.length;
    const out = new Uint8Array(n);
    let o = 0;
    for (const p of this.parts) { out.set(p, o); o += p.length; }
    return out;
  }
}

/** The usual start of a job: initialise, Kanji off, CP437, a font, spacing that joins block rows. */
export function start(job, { fontName = "a" } = {}) {
  return job.add(init(), cancelKanji(), codePage(0), font(fontName), lineSpacing(FONTS[fontName][1]));
}
