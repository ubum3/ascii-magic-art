// LuminoFrost's light: soft brand-coloured blobs drifting round the edges, behind the glass.
import { LUMINO_COLORS as C } from "../../brand/brand.js";

export interface Blob {
  color: string;
  /** Centre in 0 to 1 of the box, and radius as a share of its larger side. */
  x: number;
  y: number;
  r: number;
  /** Peak opacity. */
  a: number;
}

const SEEDS = [
  { color: C.coral, x: 0.16, y: 0.78, r: 0.42, a: 0.75, sx: 0.07, sy: 0.05, w: 0.13 },
  { color: C.peach, x: 0.82, y: 0.86, r: 0.34, a: 0.6, sx: 0.06, sy: 0.04, w: 0.17 },
  { color: C.blue, x: 0.86, y: 0.16, r: 0.44, a: 0.7, sx: 0.06, sy: 0.06, w: 0.11 },
  { color: C.plum, x: 0.08, y: 0.2, r: 0.5, a: 0.9, sx: 0.05, sy: 0.07, w: 0.09 },
  { color: C.lavender, x: 0.62, y: 0.02, r: 0.26, a: 0.35, sx: 0.08, sy: 0.03, w: 0.19 },
  { color: C.wine, x: 0.5, y: 1.02, r: 0.4, a: 0.8, sx: 0.1, sy: 0.03, w: 0.12 },
] as const;

/** The blobs at time `t` (seconds): each circles its own home, slowly. Deterministic. */
export function frostBlobs(t: number): Blob[] {
  return SEEDS.map((s, i) => ({
    color: s.color,
    x: s.x + Math.sin(t * s.w + i * 1.7) * s.sx,
    y: s.y + Math.cos(t * s.w * 0.8 + i * 2.3) * s.sy,
    r: s.r * (1 + 0.08 * Math.sin(t * s.w * 1.3 + i)),
    a: s.a,
  }));
}

/** The two light beams at time `t`: x, y (0 to 1, y up) of a point they pass through, width as a share of the height. */
export function frostBeams(t: number) {
  return [
    { color: C.peach, x: 0.2 + 0.12 * Math.sin(t * 0.07), y: 0.6, width: 0.012, a: 0.55 },
    { color: C.lavender, x: 0.8 + 0.12 * Math.sin(t * 0.06 + 2), y: 0.4, width: 0.008, a: 0.45 },
  ];
}

/** How bright the blobs are overall. */
export const LIGHT = 0.55;

/** The same blobs as CSS radial gradients over the ground: the server HTML's light. */
export function frostFallback(t = 0): string {
  return [
    `radial-gradient(40% 45% at 50% 50%, ${C.ground}cc, transparent)`,
    ...frostBlobs(t).map((b) => `radial-gradient(circle at ${(b.x * 100).toFixed(1)}% ${(100 - b.y * 100).toFixed(1)}%, ${b.color}${hex(b.a * LIGHT * 0.9)}, transparent ${(b.r * 100).toFixed(1)}vmax)`),
    C.ground,
  ].join(", ");
}

function hex(a: number) {
  return Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
}

/**
 * lumino.io's dotted globe: dots on a unit sphere turned by `spin` (radians) and
 * tipped toward the viewer, as [x, y, depth] triples (y down, depth 0 at the rim
 * to 1 facing us), back hemisphere dropped.
 */
export function globeDots(spin = 0, rows = 30): Float32Array {
  const out: number[] = [];
  const tilt = 0.4, ct = Math.cos(tilt), st = Math.sin(tilt);
  for (let i = 1; i < rows; i++) {
    const lat = -Math.PI / 2 + (Math.PI * i) / rows;
    const ring = Math.max(1, Math.round(rows * 2 * Math.cos(lat)));
    for (let j = 0; j < ring; j++) {
      const lon = (Math.PI * 2 * j) / ring + spin;
      const x = Math.cos(lat) * Math.sin(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.cos(lon);
      const y2 = y * ct - z * st, z2 = y * st + z * ct;
      if (z2 < 0.02) continue;
      out.push(x, -y2, z2);
    }
  }
  return new Float32Array(out);
}
