/*
 * ascii-magic-art-extras: pieces made from data instead of code. A spec (plain
 * JSON, see spec.d.ts) says which kind and how; fromSpec turns it into a piece
 * module that plays anywhere a piece does: the web player, React, the CLI, and the
 * Rust and Go packages (which run this same code).
 *
 *   import { fromSpec } from "ascii-magic-art-extras";
 *   const piece = fromSpec({ kind: "text", text: "DEPLOYED", effect: "scramble" });
 *   const draw = piece.default();
 *   draw(1.2);                     // a frame
 *   draw(1.2, { value: 0.4 });     // data kinds take state as well
 */
import { restyle } from "ascii-magic-art/runtime/glyphs.js";
import { image } from "./image.js";
import { brand } from "./brand.js";
import { text } from "./text.js";
import { progress, sparkline, ticker, celebrate } from "./data.js";
import { qr } from "./qr.js";
import { layoutKind } from "./layout.js";

export const KINDS = { image, brand, text, progress, sparkline, ticker, celebrate };
KINDS.qr = qr;
KINDS.layout = layoutKind;

/** A spec to { meta, create } where create() returns draw(t, state?). Throws on an unknown kind. */
export function make(spec) {
  if (typeof spec === "string") spec = JSON.parse(spec);
  const kind = KINDS[spec && spec.kind];
  if (!kind) throw new Error(`unknown kind ${JSON.stringify(spec && spec.kind)}: one of ${Object.keys(KINDS).join(", ")}`);
  return kind(spec);
}

/**
 * A spec to a piece module ({ meta, default: create }). With look options, every
 * frame is redrawn in that look; spec.look only sets the default look for players
 * that read meta.look.
 */
export function fromSpec(spec, look) {
  const { meta, create } = make(spec);
  const on = look && (look.chars || (look.look && look.look !== "original") || look.mono);
  return Object.freeze({
    meta,
    default: on ? () => { const d = create(); return (t, s) => restyle(d(t, s), meta.palette, look); } : create,
  });
}

export { image, brand, text, progress, sparkline, ticker, celebrate, layoutKind };
export { BRAND_EFFECTS, BRAND_IDLES } from "./brand.js";
export { TEXT_EFFECTS, layout } from "./text.js";
export { cellsFromPixels, buildPalette, cellsFrame, gridSize } from "./media.js";
export { encodeClip, decodeClip, readClipHeader, splitFrames, clipPiece } from "./clip.js";
export { TRANSITIONS, mixFrames, mergePalettes, sequence } from "./transition.js";
export { qr, QR_EFFECTS } from "./qr.js";
