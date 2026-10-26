// LuminoFrost's slabs: the brandmark's three parts, laid out by CSS and drifted by JS. Pure, so it can be tested.
import { BRANDMARK } from "../../brand/brand.js";

export interface FrostPart {
  /** Index into BRANDMARK.paths (0 base, 1 right blade, 2 left blade). */
  path: number;
  /** The part's box in viewBox units, padded a little: x, y, width, height. */
  box: readonly [number, number, number, number];
}

const PAD = 4;
const box = (x0: number, y0: number, x1: number, y1: number) => [x0 - PAD, y0 - PAD, x1 - x0 + 2 * PAD, y1 - y0 + 2 * PAD] as const;

/** The three parts, back to front: the base, then the blades. */
export const FROST_PARTS: readonly FrostPart[] = [
  { path: 0, box: box(404.47, 1286.85, 1595.53, 1556.34) },
  { path: 1, box: box(1021, 443.65, 1640.39, 1475.06) },
  { path: 2, box: box(359.61, 443.65, 979, 1475.06) },
];

/** How the exploded mark sits in the box for one orientation (CSS lengths). */
interface Arrangement {
  /** CSS length of one viewBox unit. */
  unit: string;
  /** Where each part is pushed from its place in the mark, as [x, y] CSS lengths, by FROST_PARTS index. */
  push: readonly (readonly [string, string])[];
}

/** Landscape: the mark about the box's height, blades pushed out to the sides, the base down past the card. */
const WIDE: Arrangement = {
  unit: "calc(104cqh / 1111)",
  push: [["0cqw", "5cqh"], ["17cqw", "-2cqh"], ["-17cqw", "-2cqh"]],
};

/** Portrait (phones): the mark wider than the box, blades leaning in from the sides, the base under the card. */
const TALL: Arrangement = {
  unit: "calc(64cqh / 1111)",
  push: [["0cqw", "15cqh"], ["13cqw", "-6cqh"], ["-13cqw", "-6cqh"]],
};

function rules(scope: string, a: Arrangement) {
  return FROST_PARTS.map(({ box: [x, y, w, h] }, i) => {
    const [px, py] = a.push[i]!;
    return `${scope} [data-part="${i}"]{left:calc(50cqw + ${(x - 1000).toFixed(2)} * ${a.unit} + ${px});top:calc(50cqh + ${(y - 1000).toFixed(2)} * ${a.unit} + ${py});width:calc(${w.toFixed(2)} * ${a.unit});height:calc(${h.toFixed(2)} * ${a.unit})}`;
  }).join("");
}

/**
 * The stylesheet that places the slabs inside `scope` (a selector for an element with
 * `container-type: size` and `container-name: lumino-frost`): wide boxes first, then
 * tall ones. Pure CSS, so the server HTML is already laid out.
 */
export function frostCSS(scope: string): string {
  return `${rules(scope, WIDE)}@container lumino-frost (orientation: portrait){${rules(scope, TALL)}}`;
}

/** The SVG transform that maps a part's path into its own 0 to 1 box (for clipPathUnits="objectBoundingBox"). */
export function partClipTransform(part: FrostPart): string {
  const [x, y, w, h] = part.box;
  return `scale(${(1 / w).toFixed(8)} ${(1 / h).toFixed(8)}) translate(${(-x).toFixed(2)} ${(-y).toFixed(2)})`;
}

/** A part's path data (viewBox units). */
export function partPath(part: FrostPart): string {
  return BRANDMARK.paths[part.path]!;
}

export interface SlabDrift {
  /** Offset in cqmin. */
  x: number;
  y: number;
  /** Rotation in degrees. */
  rotate: number;
  /** Where the light sweep along the edge is, 0 to 1. */
  sweep: number;
}

/**
 * Part `i`'s slow drift at time `t` (seconds): the parts breathe apart and back like
 * a mark coming loose, each bobbing on its own, and lean away from the pointer
 * (px, py in -0.5 to 0.5) for parallax. Deterministic, so a still frame is stable.
 */
export function slabDrift(i: number, t: number, px = 0, py = 0): SlabDrift {
  const phase = i * 2.1;
  const breathe = 0.5 - 0.5 * Math.cos(t * 0.16);
  const out = [[0, 1.6], [1.8, -0.6], [-1.8, -0.6]][i] ?? [0, 0];
  const depth = [0.6, 1, 1][i] ?? 1;
  return {
    x: out[0]! * breathe + Math.sin(t * 0.21 + phase) * 0.9 - px * 2.4 * depth,
    y: out[1]! * breathe + Math.cos(t * 0.17 + phase * 1.3) * 0.8 + py * 1.8 * depth,
    rotate: Math.sin(t * 0.11 + phase) * (i === 0 ? 0.5 : 1.4),
    sweep: (t * 0.06 + i * 0.27) % 1,
  };
}
