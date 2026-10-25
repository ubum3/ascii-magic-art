/*
 * image.js: the "image" kind. A picture from media.js (or the studio CLI), played
 * by lib/image.js with its optional motions: glint, breathe, water, drift, twinkle,
 * birds, shooting stars.
 *
 *   { kind: "image", cols, rows, square: true, palette, color: [...], level: [...],
 *     motion: { glint: true, breathe: 0.3 } }
 */
import { imagePiece } from "ascii-magic-art/lib/image.js";
import { metaFor } from "./util.js";

export function image(spec) {
  const meta = metaFor(spec, {
    cols: spec.cols, rows: spec.rows, fps: spec.fps || 15, palette: spec.palette,
    ...(spec.square !== false ? { cell: "square" } : {}),
    ...(spec.look ? { look: spec.look } : {}),
    ...(spec.still ? { still: true } : {}),
  });
  return { meta, create: imagePiece(meta, { color: spec.color, level: spec.level }, spec.motion || {}) };
}
