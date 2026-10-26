// The brandmark for canvases and shaders: as a Path2D, drawn to a canvas, or as a signed distance field.
import { BRANDMARK } from "./brand.js";

/** The brandmark's three paths as Path2D objects, in viewBox units (browser only). */
export function brandmarkPaths(): Path2D[] {
  return BRANDMARK.paths.map((d) => new Path2D(d));
}

export interface MarkCanvasOptions {
  /** Fill: any canvas fillStyle. Default white. */
  fill?: string | CanvasGradient;
  /** Empty margin around the mark, as a share of the canvas side. Default 0.1. */
  padding?: number;
  /** Blur in canvas pixels, for a soft glow. Default 0. */
  blur?: number;
  /** Which paths to draw (0 base, 1 right blade, 2 left blade). Default all. */
  parts?: readonly number[];
}

/**
 * Fit the mark's tight box into a w x h canvas with `padding`, centred: the
 * transform to draw `brandmarkPaths()` with. Returns [scale, offsetX, offsetY].
 */
export function markTransform(w: number, h: number, padding = 0.1): [number, number, number] {
  const [bx, by, bw, bh] = BRANDMARK.bounds;
  const s = Math.min((w * (1 - 2 * padding)) / bw, (h * (1 - 2 * padding)) / bh);
  return [s, (w - bw * s) / 2 - bx * s, (h - bh * s) / 2 - by * s];
}

/** Draw the mark into a new canvas, `width` x `height` (default square), e.g. for a WebGL texture. */
export function brandmarkCanvas(width: number, height = width, options: MarkCanvasOptions = {}): HTMLCanvasElement {
  const { fill = "#ffffff", padding = 0.1, blur = 0, parts = [0, 1, 2] } = options;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const [s, x, y] = markTransform(width, height, padding);
  ctx.setTransform(s, 0, 0, s, x, y);
  if (blur) ctx.filter = `blur(${blur / s}px)`;
  ctx.fillStyle = fill;
  const paths = brandmarkPaths();
  for (const i of parts) ctx.fill(paths[i]!);
  return canvas;
}

/** 1D squared Euclidean distance transform (Felzenszwalb and Huttenlocher), in place over f with stride. */
function edt1d(f: Float32Array, off: number, stride: number, n: number, d: Float32Array, v: Int32Array, z: Float32Array) {
  let k = 0;
  v[0] = 0;
  z[0] = -Infinity;
  z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    const fq = f[off + q * stride]!;
    let s = (fq + q * q - (f[off + v[k]! * stride]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    while (s <= z[k]!) {
      k--;
      s = (fq + q * q - (f[off + v[k]! * stride]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
    }
    k++;
    v[k] = q;
    z[k] = s;
    z[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1]! < q) k++;
    const r = q - v[k]!;
    d[q] = r * r + f[off + v[k]! * stride]!;
  }
  for (let q = 0; q < n; q++) f[off + q * stride] = d[q]!;
}

function edt(inside: Uint8Array, w: number, h: number, want: number): Float32Array {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = inside[i] === want ? 0 : 1e20;
  const n = Math.max(w, h), d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1);
  for (let x = 0; x < w; x++) edt1d(f, x, w, h, d, v, z);
  for (let y = 0; y < h; y++) edt1d(f, y * w, 1, w, d, v, z);
  return f;
}

export interface MarkSDF {
  /** One byte a pixel: 128 on the outline, higher inside, lower outside. */
  data: Uint8Array;
  width: number;
  height: number;
  /** Distance in pixels that one byte step stands for: distance = (byte - 128) * spread / 127. */
  spread: number;
}

/**
 * The mark as a signed distance field, `size` x `size` (default 256), ready for
 * an R8 texture (see `markSDFTexture` in backgrounds/gl.ts). In the shader,
 * `(texture(uMark, uv).r - 0.5) * 2.0` runs from -1 (spread pixels outside) to
 * +1 (spread pixels inside), and 0 is the edge. `padding` is the margin as a
 * share of the side; leave room for the spread.
 */
export function brandmarkSDF(size = 256, options: { padding?: number; spread?: number; parts?: readonly number[] } = {}): MarkSDF {
  const { padding = 0.12, spread = size / 8, parts } = options;
  const img = brandmarkCanvas(size, size, { padding, parts }).getContext("2d")!.getImageData(0, 0, size, size).data;
  const inside = new Uint8Array(size * size);
  for (let i = 0; i < inside.length; i++) inside[i] = img[i * 4 + 3]! > 127 ? 1 : 0;
  const out = edt(inside, size, size, 1), inn = edt(inside, size, size, 0);
  const data = new Uint8Array(size * size);
  for (let i = 0; i < data.length; i++) {
    const dist = inside[i] ? Math.sqrt(inn[i]!) - 0.5 : -(Math.sqrt(out[i]!) - 0.5);
    data[i] = Math.max(0, Math.min(255, Math.round(128 + (dist / spread) * 127)));
  }
  return { data, width: size, height: size, spread };
}

/**
 * Points spread evenly over the mark (inside its fill), in 0 to 1 coordinates of a
 * square with `padding`, y down. Deterministic for a given seed; handy for particles.
 */
export function brandmarkPoints(count: number, options: { padding?: number; seed?: number; parts?: readonly number[] } = {}): Float32Array {
  const { padding = 0.1, seed = 1, parts } = options;
  const N = 256, img = brandmarkCanvas(N, N, { padding, parts }).getContext("2d")!.getImageData(0, 0, N, N).data;
  const cells: number[] = [];
  for (let i = 0; i < N * N; i++) if (img[i * 4 + 3]! > 127) cells.push(i);
  let s = seed >>> 0 || 1;
  const rand = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const out = new Float32Array(count * 2);
  for (let i = 0; i < count && cells.length; i++) {
    const c = cells[Math.floor(rand() * cells.length)]!;
    out[i * 2] = ((c % N) + rand()) / N;
    out[i * 2 + 1] = (Math.floor(c / N) + rand()) / N;
  }
  return out;
}

/**
 * Points on the mark's outlines, in the same 0 to 1 square as `brandmarkPoints`,
 * picked evenly from the edge pixels in raster order (not path order: sort or
 * nearest-neighbour them to walk the edge). For arcs, constellations and glows.
 */
export function brandmarkOutline(count: number, options: { padding?: number } = {}): Float32Array {
  const { padding = 0.1 } = options;
  const N = 512, sdf = brandmarkSDF(N, { padding, spread: 2 });
  const edge: number[] = [];
  for (let y = 1; y < N - 1; y++) for (let x = 1; x < N - 1; x++) {
    const i = y * N + x, v = sdf.data[i]!;
    if (v >= 128 && (sdf.data[i - 1]! < 128 || sdf.data[i + 1]! < 128 || sdf.data[i - N]! < 128 || sdf.data[i + N]! < 128)) edge.push(i);
  }
  const out = new Float32Array(count * 2), step = edge.length / Math.max(1, count);
  for (let i = 0; i < count && edge.length; i++) {
    const c = edge[Math.floor(i * step)]!;
    out[i * 2] = (c % N + 0.5) / N;
    out[i * 2 + 1] = (Math.floor(c / N) + 0.5) / N;
  }
  return out;
}
