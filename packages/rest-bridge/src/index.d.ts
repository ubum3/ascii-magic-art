import type { Frame, PieceMeta, PieceModule } from "ascii-magic-art/lib/types.js";

/** An ascii.rest piece module, as `import * as rust from "ascii.rest/pieces/rust"` gives it. */
export interface RestMeta {
  name: string; category: string; note: string;
  cols: number; rows: number; fps: number;
  options?: Record<string, unknown>; clock?: boolean;
  palette?: readonly string[]; ground?: string; cell?: 1 | 2; loop?: number; still?: number;
}
export interface RestEnv { paper?: boolean; color?: Uint8Array }
export interface RestPiece {
  meta: RestMeta;
  default(options?: Record<string, unknown>): (t: number, env?: RestEnv) => string;
}

/** Their categories, as ours. */
export declare const CATEGORY: Record<string, string>;
/** The default ink of our players, as a colour in their palettes. */
export declare const INK: string;
/** A palette folded to at most `most` colours: what is left, and each old index's new one. */
export declare function fold(palette: readonly string[], most: number): { palette: string[]; map: number[] };

/** One of their pieces as one of ours, drawn for a dark page. */
export declare function fromRest(mod: RestPiece, opts?: { slug?: string; paper?: boolean; options?: Record<string, unknown> }): PieceModule & { meta: PieceMeta & { bg?: string; clock?: boolean } };
/** One of ours as one of theirs, for svg(). `state` for data kinds, `seconds` for the SVG's loop. */
export declare function toRest(mod: { meta: PieceMeta; default: () => (t: number, state?: any) => Frame }, opts?: { state?: unknown; ink?: string; seconds?: number; palette?: Record<string, string> }): RestPiece;
/** The colours any frame brings in its own palette, at these times. */
export declare function framePalettes(mod: { meta: PieceMeta; default: () => (t: number, state?: any) => Frame }, times: number[], state?: unknown): Record<string, string>;

/** Their file names. */
export declare const restNames: string[];
/** Every slug: "rest-rust", ... */
export declare const restSlugs: string[];
export declare function isRestSlug(s: unknown): boolean;
/** Their raw module, by our slug or their name. */
export declare function restModule(slug: string): Promise<RestPiece>;
/** One of their pieces as a piece module of ours. */
export declare function restPiece(slug: string, opts?: { paper?: boolean; options?: Record<string, unknown> }): Promise<PieceModule>;
/** Every piece, loaded when asked for. */
export declare const restPieces: Record<string, () => Promise<PieceModule>>;

export interface SvgOptions {
  dark?: boolean; ink?: string; seconds?: number; from?: number; fps?: number; once?: boolean;
  scale?: number; label?: string; options?: Record<string, unknown>; budget?: number | false;
}
/** Any piece of theirs as an animated SVG (a string). */
export declare function svg(piece: RestPiece, o?: SvgOptions): string;
/** Text in block letters as an SVG, with art beside it and a tagline. */
export declare function bannerSvg(text: string, o?: Record<string, unknown>): string;
/** Text in block letters as a piece of theirs. */
export declare function banner(text: string, o?: Record<string, unknown>): RestPiece & { text: string; motion: { seconds: number; from: number; once: boolean } };
export declare const fonts: Record<string, unknown>;
export declare const shadows: Record<string, unknown>;

export interface Drawing {
  style: "logo" | "shade" | "pixels"; cols: number; rows: number;
  colors: [number, number, number][]; art: string[]; mono: string[]; ink: string[];
  knocked: boolean; ground: string | null; ramp?: string;
}
/** An image as cells: the characters whose shapes best match its edges, and a colour digit per cell. */
export declare function drawing(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, o?: Record<string, unknown>): Drawing;
/** An image as a piece of theirs. */
export declare function fromPixels(rgba: Uint8Array | Uint8ClampedArray, width: number, height: number, o?: Record<string, unknown>): RestPiece;

/** [slug, name, category (ours), category (theirs), note, cols, rows, fps, square] for every piece. */
export declare const REST_CATALOG: [string, string, string, string, string, number, number, number, 0 | 1][];
/** A piece's size without loading it. */
export declare function restSize(slug: string): { cols: number; rows: number; square: boolean } | undefined;
