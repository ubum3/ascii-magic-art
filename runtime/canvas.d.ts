import type { Frame, LookOptions, Palette, PieceMeta } from "../lib/types.js";

export { LOOKS } from "./glyphs.js";

export declare const FONT: string;
/** Width of one monospace cell as a fraction of the font size. */
export declare const CELL_W: number;
/** Cell height / width: 1 for square-cell pieces, about 1.66 for text pieces. */
export declare const cellAspect: (meta?: Pick<PieceMeta, "cell"> | null) => number;
export declare const SHAPE_LOOKS: { dots: "circle"; squares: "square"; dither: "dither" };
export type RenderMode = "text" | "circle" | "square" | "dither";
export declare function renderMode(meta: Pick<PieceMeta, "look"> | null | undefined, look?: LookOptions): RenderMode;
export declare function cellSize(ctx: CanvasRenderingContext2D, px: number, aspect?: number): [number, number];
export declare function toHex(c: string): string;

export interface PaintOptions extends LookOptions {
  x?: number; y?: number; cw: number; ch: number; ink?: string; mode?: RenderMode;
  atlas?: GlyphAtlas; dpr?: number; over?: boolean; backing?: number; boost?: number;
}
export declare function paint(ctx: CanvasRenderingContext2D, frame: Frame, palette: Palette | undefined, opts: PaintOptions): void;

export declare class GlyphAtlas {
  reset(cw: number, ch: number, dpr: number): void;
  tile(glyph: string, color: string): [number, number];
}

export declare function drawFrame(ctx: CanvasRenderingContext2D, frame: Frame, palette: Palette | undefined, opts: Omit<PaintOptions, "cw" | "ch"> & { px?: number; aspect?: number }): [number, number];
export declare function frameFor(frame: Frame, palette: Palette | undefined, meta: PieceMeta | undefined, look?: LookOptions): { frame: Frame; mode: RenderMode };

export interface RenderToOptions {
  width: number; height: number; bg?: string; ink?: string; fit?: "contain" | "cover"; margin?: number;
  meta?: PieceMeta; look?: LookOptions;
}
/** Render a frame centred on a canvas (wallpapers, thumbnails). */
export declare function renderTo(canvas: HTMLCanvasElement, frame: Frame, palette: Palette | undefined, opts: RenderToOptions): HTMLCanvasElement;

export declare const PRESETS: Record<string, { label: string; width: number; height: number; fit: "contain" | "cover" }>;
