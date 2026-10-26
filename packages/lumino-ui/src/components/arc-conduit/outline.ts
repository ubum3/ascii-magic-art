// Pure geometry for ArcConduit: the brandmark's outlines as ordered polygons, and lightning bolts.

export type Pt = [number, number];

/** A small seeded random number generator (mulberry32), 0 to 1. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ARGS: Record<string, number> = { m: 2, l: 2, h: 1, v: 1, c: 6, z: 0 };

/**
 * An SVG path `d` (M, L, H, V, C and Z, absolute or relative) as closed polygons, its
 * curves cut into `curveSteps` lines each. Enough for the brandmark's paths.
 */
export function parsePath(d: string, curveSteps = 8): Pt[][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const polys: Pt[][] = [];
  let poly: Pt[] = [], x = 0, y = 0, sx = 0, sy = 0, cmd = "", i = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[a-z]/i.test(tokens[i]!)) cmd = tokens[i++]!;
    else if (!cmd) throw new Error(`parsePath: number before a command in ${d.slice(0, 20)}`);
    const lower = cmd.toLowerCase(), rel = cmd !== cmd.toUpperCase();
    if (!(lower in ARGS)) throw new Error(`parsePath: unsupported command ${cmd}`);
    if (lower === "z") {
      if (poly.length > 1) polys.push(poly);
      poly = [];
      x = sx;
      y = sy;
      cmd = "";
      continue;
    }
    if (lower === "m") {
      if (poly.length > 1) polys.push(poly);
      x = (rel ? x : 0) + num();
      y = (rel ? y : 0) + num();
      sx = x;
      sy = y;
      poly = [[x, y]];
      cmd = rel ? "l" : "L";
    } else if (lower === "l") {
      x = (rel ? x : 0) + num();
      y = (rel ? y : 0) + num();
      poly.push([x, y]);
    } else if (lower === "h") {
      x = (rel ? x : 0) + num();
      poly.push([x, y]);
    } else if (lower === "v") {
      y = (rel ? y : 0) + num();
      poly.push([x, y]);
    } else {
      const ox = rel ? x : 0, oy = rel ? y : 0;
      const x1 = ox + num(), y1 = oy + num(), x2 = ox + num(), y2 = oy + num(), x3 = ox + num(), y3 = oy + num();
      for (let k = 1; k <= curveSteps; k++) {
        const t = k / curveSteps, u = 1 - t;
        poly.push([
          u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      x = x3;
      y = y3;
    }
  }
  if (poly.length > 1) polys.push(poly);
  return polys;
}

/** A closed polygon's perimeter. */
export function perimeter(poly: readonly Pt[]): number {
  let len = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i]!, b = poly[(i + 1) % poly.length]!;
    len += Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  return len;
}

/** `count` points evenly spaced around a closed polygon, in order. */
export function resample(poly: readonly Pt[], count: number): Pt[] {
  const total = perimeter(poly), step = total / count, out: Pt[] = [];
  let seg = 0, segStart = 0;
  for (let k = 0; k < count; k++) {
    const want = k * step;
    for (;;) {
      const a = poly[seg % poly.length]!, b = poly[(seg + 1) % poly.length]!;
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (want <= segStart + len || seg >= poly.length - 1) {
        const t = len > 0 ? Math.min(1, (want - segStart) / len) : 0;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
        break;
      }
      segStart += len;
      seg++;
    }
  }
  return out;
}

/**
 * A lightning bolt from a to b by midpoint displacement: 2^depth + 1 points, each
 * midpoint pushed sideways by up to `rough` times its segment's length.
 */
export function bolt(a: Pt, b: Pt, rand: () => number, depth = 5, rough = 0.28): Pt[] {
  let pts: Pt[] = [a, b];
  for (let level = 0; level < depth; level++) {
    const next: Pt[] = [pts[0]!];
    for (let i = 0; i < pts.length - 1; i++) {
      const p = pts[i]!, q = pts[i + 1]!;
      const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      const off = (rand() - 0.5) * 2 * rough * len;
      next.push([(p[0] + q[0]) / 2 - (dy / (len || 1)) * off, (p[1] + q[1]) / 2 + (dx / (len || 1)) * off], q);
    }
    pts = next;
  }
  return pts;
}

/** The index of the point in `pts` nearest to `p`. */
export function nearest(pts: readonly Pt[], p: Pt): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const d = (pts[i]![0] - p[0]) ** 2 + (pts[i]![1] - p[1]) ** 2;
    if (d < bd) {
      bd = d;
      best = i;
    }
  }
  return best;
}
