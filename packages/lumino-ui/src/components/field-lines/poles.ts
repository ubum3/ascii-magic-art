// FieldLines' magnet: the brandmark's stroke ends as poles, as pure numbers (tested in test/bg-36.test.mjs).
import { BRANDMARK } from "../../brand/brand.js";

/**
 * The poles in brandmark viewBox units, with the number of field lines each one sends
 * out (+) or takes in (-). Every stroke is a bar magnet: the blade tips meet as north,
 * their outer feet are south, and the base's two ends are north over a south middle,
 * so the field bridges the gaps between the strokes. The counts sum to zero.
 */
export const POLES: readonly (readonly [number, number, number])[] = [
  [950, 470, 1],
  [1050, 470, 1],
  [380, 1440, -1],
  [1620, 1440, -1],
  [440, 1525, 1],
  [1560, 1525, 1],
  [1000, 1310, -2],
];

/**
 * A viewBox point in the 0 to 1 square the mark is drawn in with `padding` (as
 * `brandmarkSDF` and `markTransform` lay it out), y up like the shaders.
 */
export function markUV(x: number, y: number, padding: number): [number, number] {
  const [bx, by, bw, bh] = BRANDMARK.bounds;
  const s = (1 - 2 * padding) / Math.max(bw, bh);
  const ox = (1 - bw * s) / 2 - bx * s, oy = (1 - bh * s) / 2 - by * s;
  return [x * s + ox, 1 - (y * s + oy)];
}

/**
 * The poles placed in shader units (x 0 to aspect, y 0 to 1): the mark's square has
 * side `size` centred on (cx, cy). Each pole is [x, y, lines], with `lines` field
 * lines per unit of pole strength.
 */
export function placePoles(cx: number, cy: number, size: number, lines: number, padding = 0.12): Float32Array {
  const out = new Float32Array(POLES.length * 3);
  POLES.forEach(([x, y, q], i) => {
    const [u, v] = markUV(x, y, padding);
    out[i * 3] = cx + (u - 0.5) * size;
    out[i * 3 + 1] = cy + (v - 0.5) * size;
    out[i * 3 + 2] = q * lines;
  });
  return out;
}

/**
 * Where the magnet sits for a box of this aspect: [centre x, centre y, square side].
 * Wide boxes put it low on the left, the rest at the top, clear of a centred card. It
 * switches rather than blends: halfway between the two, it would sit on the card.
 */
export function fieldLayout(aspect: number): [number, number, number] {
  if (aspect >= 1.25) return [Math.min(0.4, aspect * 0.25), 0.4, Math.min(0.8, aspect * 0.5)];
  return [aspect * 0.5, 0.86, Math.min(aspect * 1.05, 0.62)];
}
