"use client";
/*
 * ascii-magic-art-react/lens: a piece seen through a lens of time.
 *
 *   import * as torus from "ascii-magic-art/pieces/spinning-torus.js";
 *   <AsciiTimeLens piece={torus} />
 *
 * Where the cursor goes, the piece runs ahead: a small spring field (8 x 8 nodes)
 * follows the pointer and settles back when it leaves. Each frame draws the piece
 * at up to `bands` times, t + b * delta, and every cell is taken from the time its
 * point of the field asks for. With the field at rest it is the plain piece.
 *
 * For library pieces, whose frames depend on t alone. Data specs (progress,
 * sparkline, ticker, celebrate, layout) draw state as well and are refused.
 * Drawing costs up to `bands` times the piece's own, so it plays at 30 fps by
 * default. With reduced motion the player shows a still, like any other piece.
 */
import { useMemo } from "react";
import type { DrawFn, Frame, PieceModule } from "ascii-magic-art/lib/types.js";
import { AsciiPlayer, type AsciiPlayerProps } from "./client/AsciiPlayer.js";

const N = 8; // the field is N x N nodes
const DATA_KINDS = ["progress", "sparkline", "ticker", "celebrate", "layout"];

export interface TimeLensOptions {
  /** How many times a frame draws the piece at most. Default 6. */
  bands?: number;
  /** Seconds between bands. Default 0.35. */
  delta?: number;
  /** The lens's radius, as a share of the piece's width. Default 0.22. */
  radius?: number;
  /** Spring stiffness and damping: higher follows faster, lower damping wobbles. Defaults 40 and 9. */
  stiffness?: number;
  damping?: number;
}

/** The field behind a lens: where the pointer is, and how far ahead each node runs (0..1). */
export interface Lens {
  /** The pointer, as a share of the piece's width and height (0..1). */
  point(x: number, y: number): void;
  /** The pointer left: the field settles back to the plain piece. */
  leave(): void;
  /** Advance the springs by dt seconds. */
  step(dt: number): void;
  /** The band (0..bands-1) for the cell at x, y of a cols x rows piece. */
  band(x: number, y: number, cols: number, rows: number): number;
  /** N x N offsets, 0..1. */
  readonly field: Float32Array;
}

export function createLens({ bands = 6, radius = 0.22, stiffness = 40, damping = 9 }: TimeLensOptions = {}): Lens {
  const o = new Float32Array(N * N), v = new Float32Array(N * N);
  let px = 0, py = 0, on = false;
  const r2 = 2 * radius * radius;
  return {
    field: o,
    point(x, y) { px = x; py = y; on = true; },
    leave() { on = false; },
    step(dt) {
      if (!(dt > 0)) return;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const k = i + j * N, dx = (i + 0.5) / N - px, dy = (j + 0.5) / N - py;
        const target = on ? Math.exp(-(dx * dx + dy * dy) / r2) : 0;
        v[k] += (stiffness * (target - o[k]) - damping * v[k]) * dt;
        o[k] = Math.max(0, Math.min(1, o[k] + v[k] * dt));
        if (!on && o[k] < 1e-3 && Math.abs(v[k]) < 1e-3) { o[k] = 0; v[k] = 0; }
      }
    },
    band(x, y, cols, rows) {
      // bilinear between the nodes around the cell's centre
      const fx = Math.max(0, Math.min(N - 1, ((x + 0.5) / cols) * N - 0.5)), fy = Math.max(0, Math.min(N - 1, ((y + 0.5) / rows) * N - 0.5));
      const i = Math.min(N - 2, Math.floor(fx)), j = Math.min(N - 2, Math.floor(fy)), ax = fx - i, ay = fy - j;
      const at = (a: number, b: number) => o[a + b * N];
      const val = (at(i, j) * (1 - ax) + at(i + 1, j) * ax) * (1 - ay) + (at(i, j + 1) * (1 - ax) + at(i + 1, j + 1) * ax) * ay;
      return Math.max(0, Math.min(bands - 1, Math.round(val * (bands - 1))));
    },
  };
}

type Layers = { T: string[][]; C: string[][] | null };
const split = (f: Frame): Layers =>
  typeof f === "string"
    ? { T: f.split("\n").map((r) => [...r]), C: null }
    : { T: f.text.split("\n").map((r) => [...r]), C: f.color.split("\n").map((r) => [...r]) };

/**
 * One frame from several: the cell at x, y comes from frames[pick(x, y)]. Every
 * pick 0 returns frames[0] itself.
 */
export function lensFrame(frames: (Frame | undefined)[], pick: (x: number, y: number) => number, cols: number, rows: number): Frame {
  const base = frames[0];
  if (base === undefined) throw new Error("lensFrame: frames[0] is required");
  const picks: number[] = new Array(cols * rows);
  let any = false;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) { const b = pick(x, y); picks[x + y * cols] = b; if (b) any = true; }
  if (!any) return base;
  const L = frames.map((f) => (f === undefined ? undefined : split(f)));
  const colored = L.some((l) => l && l.C);
  const T: string[] = [], C: string[] = [];
  for (let y = 0; y < rows; y++) {
    let t = "", c = "";
    for (let x = 0; x < cols; x++) {
      const l = L[picks[x + y * cols]] ?? L[0]!;
      t += l.T[y]?.[x] ?? " ";
      if (colored) c += l.C ? l.C[y]?.[x] ?? " " : " ";
    }
    T.push(t);
    C.push(c);
  }
  const text = T.join("\n");
  if (!colored) return text;
  const palette = typeof base === "string" ? undefined : base.palette;
  return palette ? { text, color: C.join("\n"), palette } : { text, color: C.join("\n") };
}

/** A piece module that draws `piece` through `lens`. Throws for data specs. */
export function timeLens(piece: PieceModule, opts: TimeLensOptions = {}, lens: Lens = createLens(opts)): PieceModule {
  const m = piece.meta;
  if (m.tags?.includes("extras") && m.tags.some((t) => DATA_KINDS.includes(t)))
    throw new Error(`AsciiTimeLens: ${m.slug} draws state as well as time; use a library piece`);
  const bands = Math.max(1, Math.floor(opts.bands ?? 6)), delta = opts.delta ?? 0.35;
  const meta = { ...m, slug: `${m.slug}-lens`, fps: Math.min(m.fps || 30, 30) };
  return Object.freeze({
    meta,
    default: (): DrawFn => {
      const draws: (DrawFn | undefined)[] = new Array(bands);
      let last = NaN;
      return (t: number) => {
        lens.step(Number.isFinite(last) ? Math.min(0.1, Math.max(0, t - last)) : 0);
        last = t;
        const picks = new Uint8Array(m.cols * m.rows), used = new Set<number>([0]);
        for (let y = 0; y < m.rows; y++) for (let x = 0; x < m.cols; x++) used.add((picks[x + y * m.cols] = lens.band(x, y, m.cols, m.rows)));
        const frames: (Frame | undefined)[] = new Array(bands);
        for (const b of used) frames[b] = (draws[b] ??= piece.default())(t + b * delta);
        return lensFrame(frames, (x, y) => picks[x + y * m.cols], m.cols, m.rows);
      };
    },
  });
}

export interface AsciiTimeLensProps extends Omit<AsciiPlayerProps, "piece">, TimeLensOptions {
  /** A library piece module. */
  piece: PieceModule;
}

/** Plays a piece with a lens of time under the pointer. */
export function AsciiTimeLens({ piece, bands, delta, radius, stiffness, damping, maxFps = 30, ...rest }: AsciiTimeLensProps) {
  const { lens, module } = useMemo(() => {
    const opts = { bands, delta, radius, stiffness, damping };
    const lens = createLens(opts);
    return { lens, module: timeLens(piece, opts, lens) };
  }, [piece, bands, delta, radius, stiffness, damping]);
  return (
    <div
      style={{ display: "inline-block", touchAction: "none" }}
      onPointerMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        if (r.width && r.height) lens.point((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => lens.leave()}
    >
      <AsciiPlayer piece={module} maxFps={maxFps} {...rest} />
    </div>
  );
}
