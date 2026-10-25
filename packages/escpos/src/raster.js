/*
 * raster.js: a frame as a 1-bit image for GS v 0. The frame is drawn exactly as
 * the web player draws it (runtime/canvas.js renderTo, on @napi-rs/canvas) at the
 * paper's width in dots, then dithered.
 *
 * Ink follows the screen (bright is inked) and is capped at `ink` (default 0.6):
 * solid black areas print slowly, fade, and heat the head. A QR code wants
 * invert and ink 1 with a threshold.
 */
import { createCanvas, Path2D } from "@napi-rs/canvas";

if (!globalThis.document) globalThis.document = { createElement: () => createCanvas(1, 1) };
if (!globalThis.Path2D) globalThis.Path2D = Path2D;
const canvasLib = import("ascii-magic-art/runtime/canvas.js");

export const DITHERS = ["floyd", "bayer", "threshold"];
const BAYER8 = (() => {
  const m = [[0, 2], [3, 1]];
  let b = m;
  for (let n = 2; n < 8; n *= 2) b = Array.from({ length: n * 2 }, (_, y) => Array.from({ length: n * 2 }, (_, x) => 4 * b[y % n][x % n] + m[(y / n) | 0][(x / n) | 0]));
  return b;
})();

/**
 * Ink amounts (0..1, w x h) to packed rows: { bits, widthBytes, height }.
 * floyd is Floyd-Steinberg error diffusion, bayer an 8x8 ordered dither,
 * threshold cuts at 0.5 (for QR codes and line art).
 */
export function dither(ink, w, h, method = "floyd") {
  const widthBytes = Math.ceil(w / 8), bits = new Uint8Array(widthBytes * h);
  const set = (x, y) => { bits[y * widthBytes + (x >> 3)] |= 0x80 >> (x & 7); };
  if (method === "floyd") {
    const e = Float32Array.from(ink);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x, v = e[i], on = v >= 0.5 ? 1 : 0, err = v - on;
      if (on) set(x, y);
      if (x + 1 < w) e[i + 1] += (err * 7) / 16;
      if (y + 1 < h) {
        if (x > 0) e[i + w - 1] += (err * 3) / 16;
        e[i + w] += (err * 5) / 16;
        if (x + 1 < w) e[i + w + 1] += err / 16;
      }
    }
  } else {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const t = method === "bayer" ? (BAYER8[y & 7][x & 7] + 0.5) / 64 : 0.5;
      if (ink[y * w + x] > t) set(x, y);
    }
  }
  return { bits, widthBytes, height: h, width: w };
}

/** RGBA pixels to ink amounts: brightness (or darkness with invert), times `ink`. */
export function inkFromRgba(rgba, w, h, { invert = false, ink = 0.6 } = {}) {
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = rgba[i * 4 + 3] / 255;
    const l = ((0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) / 255) * a;
    out[i] = (invert ? 1 - l : l) * ink;
  }
  return out;
}

/** A frame to a dithered image `dots` wide: { bits, widthBytes, width, height }. */
export async function rasterFrame(frame, meta, { dots = 384, method = "floyd", ink = 0.6, invert = false, bg } = {}) {
  const { renderTo, cellAspect } = await canvasLib;
  const width = dots, height = Math.max(1, Math.round((dots * meta.rows * cellAspect(meta)) / meta.cols));
  const canvas = createCanvas(width, height);
  renderTo(canvas, frame, (typeof frame === "object" && frame.palette) || meta.palette, { width, height, bg: bg || (meta.qr && meta.qr.dark) || "#000000", fit: "contain", margin: 0, meta });
  const px = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  return dither(inkFromRgba(px, width, height, { invert, ink }), width, height, method);
}
