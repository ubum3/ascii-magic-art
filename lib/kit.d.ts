import type { Frame, Palette } from "./types.js";

export type Vec3 = [number, number, number];
export type BoxStyle = "light" | "heavy" | "double" | "round" | "ascii" | (string & {});

export declare const RAMPS: {
  classic: string; fine: string; dots: string; blocks: string; soft: string; lines: string;
};
/** Map 0..1 to a character of a ramp. */
export declare function ramp(v: number, chars?: string): string;

export declare const clamp: (v: number, a?: number, b?: number) => number;
export declare const lerp: (a: number, b: number, t: number) => number;
export declare const smooth: (t: number) => number;
export declare const fract: (v: number) => number;
export declare const TAU: number;

/** Deterministic PRNG (mulberry32): returns a function giving 0..1. */
export declare function rng(seed?: number): () => number;
/** 2D value noise in 0..1. */
export declare function noise2(x: number, y: number, seed?: number): number;
/** Fractal noise in 0..1. */
export declare function fbm(x: number, y: number, octaves?: number, seed?: number): number;

/** HSL (degrees, percent, percent) to "#rrggbb". */
export declare function hsl(h: number, s: number, l: number): string;
export declare const KEYS: string;
/** A palette from a list of hex colours, keyed "0".."9","a".."z","A".."Z". */
export declare function palette(hexes: string[]): Palette;
/** n hex colours spread across colour stops. */
export declare function gradient(stops: string[], n?: number): string[];

export declare class Grid {
  constructor(cols: number, rows: number);
  cols: number;
  rows: number;
  ch: string[];
  co: string[];
  z: Float32Array;
  clear(ch?: string, co?: string): this;
  inside(x: number, y: number): boolean;
  /** Put a character (and optional colour key) at x, y. */
  set(x: number, y: number, ch: string, co?: string): void;
  /** Depth-tested put: draws only when z is nearer (larger) than what is there. */
  setZ(x: number, y: number, z: number, ch: string, co?: string): void;
  get(x: number, y: number): string;
  text(x: number, y: number, s: string, co?: string): void;
  /** Multi-line block; spaces are transparent unless solid. */
  block(x: number, y: number, s: string, co?: string, solid?: boolean): void;
  hline(x0: number, x1: number, y: number, ch?: string, co?: string): void;
  vline(x: number, y0: number, y1: number, ch?: string, co?: string): void;
  box(x: number, y: number, w: number, h: number, style?: BoxStyle, co?: string): void;
  fill(x: number, y: number, w: number, h: number, ch?: string, co?: string): void;
  line(x0: number, y0: number, x1: number, y1: number, ch?: string | ((x: number, y: number) => string), co?: string): void;
  /** Ellipse outline, corrected for tall cells when aspect = 0.5. */
  circle(cx: number, cy: number, r: number, ch?: string, co?: string, aspect?: number): void;
  /** Call fn for every cell (u, v in 0..1); return [ch, co] to write. */
  shade(fn: (x: number, y: number, u: number, v: number) => [string, string?] | null | undefined | void): void;
  /** Plain text when no colours were used, else { text, color }. */
  frame(): Frame;
}

export declare function rotX(p: Vec3, a: number): Vec3;
export declare function rotY(p: Vec3, a: number): Vec3;
export declare function rotZ(p: Vec3, a: number): Vec3;
export declare const dot: (a: Vec3, b: Vec3) => number;
export declare const norm: (v: Vec3) => Vec3;
/** Perspective-project to grid coords: [x, y, scale]. */
export declare function project(p: Vec3, cols: number, rows: number, fov?: number, dist?: number): Vec3;
/** Draw a wireframe from projected vertices and edge index pairs. */
export declare function wire(g: Grid, verts: ArrayLike<number>[], edges: [number, number][], ch?: string, co?: string): void;
/** Digits and a few symbols in a 3x5 block font. Returns the width used. */
export declare function bigText(g: Grid, x: number, y: number, s: string | number, co?: string, on?: string): number;
