import type { Frame, LookName, LookOptions, Palette, PieceMeta } from "ascii-magic-art/lib/types.js";
import type { ImageMotion } from "ascii-magic-art/lib/image.js";

interface Common {
  slug?: string;
  name?: string;
  note?: string;
  fps?: number;
  /** The look players show it in by default. */
  look?: LookName;
}

/** A picture: palette keys and ink levels 0-7 per cell, from cellsFromPixels. */
export interface ImageSpec extends Common {
  kind: "image";
  cols: number; rows: number;
  palette: Palette;
  color: string[]; level: string[];
  /** Square cells (two per terminal cell, as half blocks). Default true. */
  square?: boolean;
  motion?: ImageMotion;
  still?: boolean;
}

export type BrandEffect = "reveal" | "draw" | "assemble" | "matrix" | "glitch" | "halftone" | "spin3d" | "shimmer";
export type BrandIdle = "shimmer" | "still" | "pulse" | "rain";
/** A logo mask: coverage 0-8 and a palette key per cell. */
export interface BrandSpec extends Common {
  kind: "brand";
  effect?: BrandEffect;
  idle?: BrandIdle;
  cols: number; rows: number;
  palette: Palette;
  cov: string[]; color: string[];
  /** Seconds the entrance takes. Default 2.2. */
  duration?: number;
  /** Replay every n seconds; 0 plays once, then idles. */
  loop?: number;
  square?: boolean;
  accent?: string; dim?: string; extra?: string;
}

export type TextEffect = "typewriter" | "wave" | "rainbow" | "scramble" | "glitch" | "plain";
export interface TextSpec extends Common {
  kind: "text";
  text: string;
  effect?: TextEffect;
  font?: "block" | "plain";
  /** Main, accent, shadow. */
  colors?: string[];
  shadow?: boolean;
  duration?: number;
  loop?: number;
  /** At least this size; the text is centred. */
  cols?: number; rows?: number;
}

export interface ProgressState { value: number; label?: string }
export interface ProgressSpec extends Common, Partial<ProgressState> { kind: "progress"; cols?: number; rows?: number; colors?: string[]; accent?: string }
export interface SparklineState { values: number[]; label?: string }
export interface SparklineSpec extends Common, Partial<SparklineState> { kind: "sparkline"; cols?: number; rows?: number; colors?: string[]; accent?: string }
export interface TickerItem { label: string; value?: number | string; delta?: number }
export interface TickerState { items: (TickerItem | string)[] }
export interface TickerSpec extends Common, Partial<TickerState> { kind: "ticker"; cols?: number; rows?: number; speed?: number; accent?: string }
export interface CelebrateState { message?: string; style?: "check" | "confetti" | "fireworks" | "coins" }
export interface CelebrateSpec extends Common, CelebrateState {
  kind: "celebrate"; cols?: number; rows?: number; color?: string; accent?: string;
  /** Colours for the confetti, fireworks and coins (repeated to 8). Coins default to golds. */
  hues?: string[];
  /** Other positions for the sparks and coins, so two celebrations side by side differ. Default 0. */
  seed?: number;
}

/** One spec placed on a layout. */
export interface LayoutRegion {
  /** The key for this region's state (and play counter). Default its index. */
  id?: string;
  x?: number; y?: number;
  /** Size in cells; also the spec's default cols and rows. Default: to the layout's edge. */
  w?: number; h?: number;
  spec: Spec;
  /** Seconds it plays each time play[id] changes; hidden otherwise. 0 (default) is always on. */
  play?: number;
  /** Clear the region before drawing, instead of letting spaces show what is under it. */
  opaque?: boolean;
}
/** Specs on one screen, later regions on top. */
export interface LayoutSpec extends Common {
  kind: "layout";
  cols: number; rows: number;
  regions: LayoutRegion[];
  /** Move everything by up to this many cells, slowly, against burn-in. */
  drift?: number | { cells: number; period?: number };
  square?: boolean;
}
export interface LayoutState {
  regions?: Record<string, State>;
  /** Bump a region's number to (re)start a region with `play`. */
  play?: Record<string, number | string>;
}

export type Spec = ImageSpec | BrandSpec | TextSpec | ProgressSpec | SparklineSpec | TickerSpec | CelebrateSpec | LayoutSpec;
export type State = ProgressState | SparklineState | TickerState | CelebrateState | LayoutState | Record<string, unknown>;

export type StateDrawFn = (t: number, state?: State) => Frame;
export interface SpecPiece { meta: PieceMeta; default: () => StateDrawFn }

export declare const KINDS: Record<Spec["kind"], (spec: any) => { meta: PieceMeta; create: () => StateDrawFn }>;
export declare const BRAND_EFFECTS: BrandEffect[];
export declare const BRAND_IDLES: BrandIdle[];
export declare const TEXT_EFFECTS: TextEffect[];

export declare function make(spec: Spec | string): { meta: PieceMeta; create: () => StateDrawFn };
/** A spec to a piece module, optionally redrawn in a look. */
export declare function fromSpec(spec: Spec | string, look?: LookOptions): SpecPiece;

export interface Cells { cols: number; rows: number; palette: Palette; color: string[]; level: string[] }
/** RGBA pixels (one per cell) to cells. */
export declare function cellsFromPixels(rgba: ArrayLike<number>, w: number, h: number, opts?: { palette?: string[]; colors?: number; gamma?: number }): Cells;
/** A shared palette for one or more RGBA buffers (median cut), at most 59 colours. */
export declare function buildPalette(buffers: ArrayLike<number>[], n?: number): string[];
export declare function cellsFrame(cells: Cells): { text: string; color: string };
/** Grid size for a picture of pw x ph pixels at cols wide. */
export declare function gridSize(pw: number, ph: number, cols: number, square?: boolean): [number, number];
export declare function layout(text: string, font?: "block" | "plain"): { px: { x: number; y: number; n: number; ch: string }[]; w: number; h: number; count: number };

export interface ClipHeader { version: 1; cols: number; rows: number; fps: number; frames: number; square: boolean; loop: boolean; palette?: Palette; name?: string }
export interface Clip { header: ClipHeader; frames: Frame[] }
export declare function encodeClip(header: Omit<ClipHeader, "version" | "frames" | "square" | "loop"> & Partial<ClipHeader>, frames: Frame[], deflateRaw: (u: Uint8Array) => Uint8Array): Uint8Array;
export declare function readClipHeader(bytes: Uint8Array | ArrayBuffer): { header: ClipHeader; body: Uint8Array };
export declare function decodeClip(bytes: Uint8Array | ArrayBuffer, inflateRaw: (u: Uint8Array) => Uint8Array): Clip;
export declare function splitFrames(s: string, count: number): Frame[];
export declare function clipPiece(clip: Clip): { meta: PieceMeta; default: () => (t: number) => Frame };

export declare function image(spec: ImageSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function brand(spec: BrandSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function text(spec: TextSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function progress(spec: ProgressSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function sparkline(spec: SparklineSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function ticker(spec: TickerSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function celebrate(spec: CelebrateSpec): { meta: PieceMeta; create: () => StateDrawFn };
export declare function layoutKind(spec: LayoutSpec): { meta: PieceMeta; create: () => StateDrawFn };

export type TransitionKind = "dissolve" | "wipe-right" | "wipe-left" | "wipe-down" | "wipe-up" | "melt" | "scramble" | "iris";
export declare const TRANSITIONS: TransitionKind[];
/** Palettes of several pieces as one; maps[i] turns piece i's keys into the shared ones. */
export declare function mergePalettes(palettes: (Palette | undefined)[]): { palette: Palette; maps: Record<string, string>[] };
/** Frame a turning into frame b at p (0..1), both centred in w x h. */
export declare function mixFrames(kind: TransitionKind, a: Frame, b: Frame, p: number, w: number, h: number, mapA?: Record<string, string>, mapB?: Record<string, string>): { text: string; color: string };
export interface SequenceOptions { hold?: number | number[]; kind?: TransitionKind; duration?: number; loop?: boolean }
/** Pieces one after another, with a transition between each: a piece module. */
export declare function sequence(pieces: { meta: PieceMeta; default: () => (t: number, state?: any) => Frame }[], opts?: SequenceOptions): SpecPiece;
