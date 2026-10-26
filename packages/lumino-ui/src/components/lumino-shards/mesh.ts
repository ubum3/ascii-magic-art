// The brandmark cut into glass shards: pure (no DOM), so it can be tested in node.

export interface ShardMeshOptions {
  /** Lattice columns across the square: more columns, smaller and more shards. Default 36. */
  cols?: number;
  /** Seed for the lattice jitter and each shard's random numbers. Default 1. */
  seed?: number;
  /** How far lattice points wander, as a share of the cell. Default 0.38. */
  jitter?: number;
  /**
   * Also keep triangles that only touch the shape at a corner (not just those whose
   * centroid is in it), so a renderer that trims shards to the outline gets every
   * part of it, thin tips included. Default true.
   */
  touching?: boolean;
}

/**
 * The shards as non-indexed triangles (three vertices each), in the unit square
 * the `inside` test was asked about (0 to 1, y up).
 */
export interface ShardMesh {
  /** Number of shards (triangles); the arrays hold count * 3 vertices. */
  count: number;
  /** Per vertex, 2 floats: the vertex minus its shard's centroid. */
  local: Float32Array;
  /** Per vertex, 2 floats: the shard's centroid, its place in the mark. */
  home: Float32Array;
  /** Per vertex, 3 floats: the corner's barycentric coordinate, (1,0,0), (0,1,0) or (0,0,1). */
  bary: Float32Array;
  /** Per vertex, 4 floats in 0 to 1: the shard's random numbers, the same on its three vertices. */
  rand: Float32Array;
}

/** A small seeded generator (mulberry32), 0 to 1. */
function random(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Triangulate a shape into shards: a jittered triangular lattice over the unit
 * square, keeping each triangle whose centroid `inside(x, y)` (0 to 1, y up) says
 * is in the shape (and, with `touching`, any with a corner in it). Deterministic for a given seed.
 */
export function shardMesh(inside: (x: number, y: number) => boolean, options: ShardMeshOptions = {}): ShardMesh {
  const { cols: c = 36, seed = 1, jitter = 0.38, touching = true } = options;
  const cols = Math.max(2, Math.round(c));
  const rand = random(seed);
  const s = 1 / cols, h = (s * Math.sqrt(3)) / 2;
  const rows = Math.ceil(1 / h) + 1, across = cols + 2;
  // Lattice points; odd rows shifted half a cell, every point jittered.
  const px = new Float64Array(rows * across), py = new Float64Array(rows * across);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < across; i++) {
      const k = j * across + i;
      px[k] = (i - 0.5 + (j % 2 ? 0.5 : 0)) * s + (rand() - 0.5) * jitter * s;
      py[k] = j * h + (rand() - 0.5) * jitter * h;
    }
  }
  const tris: number[] = [];
  const add = (a: number, b: number, d: number) => {
    const cx = (px[a]! + px[b]! + px[d]!) / 3, cy = (py[a]! + py[b]! + py[d]!) / 3;
    if (cx <= 0 || cx >= 1 || cy <= 0 || cy >= 1) return;
    const keep = inside(cx, cy) || (touching && [a, b, d].some((v) => inside(Math.min(1, Math.max(0, px[v]!)), Math.min(1, Math.max(0, py[v]!)))));
    if (keep) tris.push(a, b, d);
  };
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < across - 1; i++) {
      const p = j * across + i, q = (j + 1) * across + i;
      if (j % 2 === 0) {
        add(p, p + 1, q);
        add(p + 1, q + 1, q);
      } else {
        add(p, q + 1, q);
        add(p, p + 1, q + 1);
      }
    }
  }
  const count = tris.length / 3;
  const local = new Float32Array(count * 6), home = new Float32Array(count * 6);
  const bary = new Float32Array(count * 9), rnd = new Float32Array(count * 12);
  for (let t = 0; t < count; t++) {
    const a = tris[t * 3]!, b = tris[t * 3 + 1]!, d = tris[t * 3 + 2]!;
    const cx = (px[a]! + px[b]! + px[d]!) / 3, cy = (py[a]! + py[b]! + py[d]!) / 3;
    const r = [rand(), rand(), rand(), rand()];
    [a, b, d].forEach((v, corner) => {
      const n = t * 3 + corner;
      local[n * 2] = px[v]! - cx;
      local[n * 2 + 1] = py[v]! - cy;
      home[n * 2] = cx;
      home[n * 2 + 1] = cy;
      bary[n * 3 + corner] = 1;
      rnd.set(r, n * 4);
    });
  }
  return { count, local, home, bary, rand: rnd };
}
