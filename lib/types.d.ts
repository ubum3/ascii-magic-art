/*
 * types.d.ts: the shapes shared by pieces, the kit and the runtime.
 */

/** Colour keys (single characters) to "#rrggbb". */
export type Palette = Record<string, string>;

/** What draw(t) returns: plain text, or text plus a colour layer of palette keys the same shape. */
export type Frame = string | { text: string; color: string; palette?: Palette };

/** A piece's frame at t seconds. */
export type DrawFn = (t: number) => Frame;

export type LookName =
  | "original" | "dots" | "ascii" | "dense" | "numbers" | "binary"
  | "letters" | "blocks" | "squares" | "lines" | "dither";

export interface ToneOptions { lo?: number; hi?: number; curve?: number; sat?: number; gamma?: number; floor?: number }

/** Options for redrawing a frame in a look (see runtime/glyphs.js and runtime/canvas.js). */
export interface LookOptions {
  look?: LookName;
  /** Your own characters, sorted light to dark for you. Wins over look. */
  chars?: string;
  /** Redraw text and line work too, not only shading. */
  all?: boolean;
  /** One colour instead of the palette. */
  mono?: boolean;
  /** Contrast curve: below 1 lifts darks, above 1 deepens them. */
  gamma?: number;
  /** false keeps the original colours instead of brightening them. */
  lift?: boolean;
  /** Halftone dot size as a share of the cell. */
  size?: number;
  /** Halftone dots per cell along each side. */
  density?: number;
  /** Halftone dot sizes: 0 = smooth. */
  steps?: number;
  invert?: boolean;
  tone?: ToneOptions;
  [key: string]: unknown;
}

export interface PieceMeta {
  slug: string;
  name: string;
  category: string;
  note: string;
  tags: string[];
  cols: number;
  rows: number;
  fps: number;
  palette?: Palette;
  /** "square" for picture pieces whose cells are square pixels. */
  cell?: "square";
  /** The look the piece is shown in by default. */
  look?: LookName;
  /** The piece's own halftone tuning. */
  dots?: LookOptions;
  /** One frame only, no animation. */
  still?: boolean;
}

/** A piece module: `import * as piece from "ascii-magic-art/pieces/<slug>.js"`. */
export interface PieceModule<M extends PieceMeta = PieceMeta> {
  meta: M;
  default: () => DrawFn;
}
