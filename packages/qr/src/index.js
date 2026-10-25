/*
 * ascii-magic-art-qr: a QR code as a piece. It makes an entrance (assemble,
 * reveal, matrix or glitch) and settles into a scannable code in half blocks.
 *
 *   import { qrPiece } from "ascii-magic-art-qr";
 *   const piece = qrPiece("https://pay.example/r/42", { effect: "assemble", brand: "#635bff" });
 *   const draw = piece.default();
 *   draw(0.5);   // mid-entrance
 *   draw(2);     // the settled code, from `settle` (1.5 s) on
 *
 * The same thing is the "qr" kind in ascii-magic-art-extras, so a JSON spec plays
 * in React and in the Rust and Go packages too:
 *   { "kind": "qr", "text": "https://pay.example/r/42", "effect": "matrix" }
 *
 * Show it on a background at least as dark as `dark` (default #09090b): the frame
 * inks the light modules and the quiet zone, the dark modules are the background.
 */
import { qr, qrMatrix, QR_EFFECTS, QR_ECC, luminance } from "./kind.js";

export { qr, qrMatrix, QR_EFFECTS, QR_ECC, luminance };

const prefersReduced = () => {
  try { return !!(globalThis.matchMedia && globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches); } catch (e) { return false; }
};

/** The options of qrPiece to a "qr" spec. `brand` is shorthand for the entrance colour. */
export function qrSpec(text, opts = {}) {
  const { brand, ...rest } = opts;
  return { kind: "qr", text, ...(brand ? { accent: brand } : {}), ...rest };
}

/**
 * A piece module ({ meta, default }) for a QR code. In a browser that asks for
 * reduced motion it is still: the settled code from the first frame.
 * Warns (console.warn) above version 7, which is wider than 48 columns.
 */
export function qrPiece(text, opts = {}) {
  const spec = qrSpec(text, { ...opts, still: opts.still ?? (opts.reducedMotion ?? prefersReduced()) });
  const { meta, create } = qr(spec);
  if (meta.qr.version > 7 && opts.warn !== false && typeof console !== "undefined") {
    console.warn(`ascii-magic-art-qr: version ${meta.qr.version} is ${meta.cols} columns wide; keep the text short (version 7 or less) for 48-column terminals and receipts`);
  }
  return Object.freeze({ meta, default: create });
}

/** The settled code as a still frame: { text, color, palette, cols, rows, qr }. */
export function qrFrame(text, opts = {}) {
  const { meta, create } = qr(qrSpec(text, { ...opts, still: true }));
  return { ...create()(0), palette: meta.palette, cols: meta.cols, rows: meta.rows, qr: meta.qr };
}
