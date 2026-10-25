import type { Frame, LookOptions, Palette, PieceModule } from "../lib/types.js";

/** A frame as HTML: escaped text, one colour span per run. */
export declare function frameHTML(frame: Frame, palette?: Palette, ink?: string): string;
export declare const frameText: (f: Frame) => string;

export interface PlayOptions {
  /** Playback speed, 1 is normal. */
  speed?: number;
  /** One frame, no animation. Default: honour prefers-reduced-motion. */
  still?: boolean;
  look?: LookOptions;
  /** Rewrite the <pre> each frame instead of drawing on a canvas (selectable text, slower). */
  dom?: boolean;
  /** Start time in seconds. */
  t0?: number;
  maxFps?: number;
  onFrame?: (frame: Frame, t: number) => void;
}

/** Play a piece in a <pre>. Returns stop(). */
export declare function play(pre: HTMLPreElement, mod: PieceModule, opts?: PlayOptions): () => void;
