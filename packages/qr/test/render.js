/*
 * render.js: draw a frame exactly as the web player and `ama-studio export` do
 * (runtime/canvas.js renderTo on @napi-rs/canvas) and read it back with jsQR.
 */
import { createCanvas, Path2D } from "@napi-rs/canvas";
import jsQR from "jsqr";

if (!globalThis.document) globalThis.document = { createElement: () => createCanvas(1, 1) };
if (!globalThis.Path2D) globalThis.Path2D = Path2D;
const { renderTo } = await import("ascii-magic-art/runtime/canvas.js");

/** A frame to RGBA pixels, `px` pixels a cell wide, on the code's own dark background. */
export function pixels(frame, meta, { px = 8, look } = {}) {
  const width = Math.ceil((meta.cols * px) / 0.96), height = Math.ceil((meta.rows * px * (1 / 0.602)) / 0.96);
  const canvas = createCanvas(width, height);
  renderTo(canvas, frame, frame.palette || meta.palette, { width, height, bg: meta.qr.dark, fit: "contain", margin: 0.02, meta, look: look || {} });
  const data = canvas.getContext("2d").getImageData(0, 0, width, height).data;
  return { data: new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height, canvas };
}

/** The text jsQR reads from a frame, or null. */
export function decode(frame, meta, opts) {
  const { data, width, height } = pixels(frame, meta, opts);
  const r = jsQR(data, width, height, { inversionAttempts: "dontInvert" });
  return r ? r.data : null;
}
