import type { DrawFn, Frame, LookName, LookOptions, Palette } from "../lib/types.js";

export declare const LOOKS: Record<LookName, { label: string; chars: string | null; sample?: string }>;
/** Sort characters by ink, light to dark, keeping a leading space. */
export declare function ramp(chars: string): string[];
/** Redraw a frame in a look. */
export declare function restyle(frame: Frame, palette: Palette | undefined, opts?: LookOptions & { merge?: number }): Frame;
/** Wrap a draw function so every frame comes out in a look. */
export declare function withLook(draw: DrawFn, palette: Palette | undefined, opts?: LookOptions): DrawFn;
export declare function densityGrid(frame: Frame, palette: Palette | undefined, opts?: LookOptions): {
  T: string[][]; C: string[][] | null; D: number[][]; w: number; h: number;
};
export declare function shadeTester(T: string[][]): (ch: string) => boolean;
export declare function lift(palette: Palette): Palette;
export declare function lift(palette: undefined): undefined;
/** Ink coverage of a glyph, 0..100. */
export declare const cover: (ch: string) => number;
export declare const isShade: (codePoint: number) => boolean;
