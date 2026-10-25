import type { LookName, LookOptions } from "ascii-magic-art/lib/types.js";

/** Props that redraw a piece in another set of characters. Same as the <ascii-art> attributes. */
export interface LookProps {
  /** dots, ascii, dense, numbers, binary, letters, blocks, squares, lines or dither. */
  look?: LookName;
  /** Your own characters instead of a look, e.g. " .oO@" (sorted light to dark for you). */
  chars?: string;
  /** One colour (the text colour) instead of the piece's palette. */
  mono?: boolean;
  /** With look or chars, redraw text and line work too, not only shading. */
  all?: boolean;
  /** 0 to 100, default 0. */
  contrast?: number;
  /** Halftone dot size for the dots look, 25 to 120, default 51. */
  dotSize?: number;
  /** Halftone dot spacing, 40 to 250, default 131 (more dots, same size). */
  density?: number;
  /** Halftone dot sizes: 3, 5, or 0 for smooth. */
  steps?: number;
}

/** LookProps to the runtime's look options, with the same mapping as runtime/ascii.js. */
export function toLook(p: LookProps): LookOptions {
  const o: LookOptions = {};
  if (p.look) o.look = p.look;
  if (p.chars) o.chars = p.chars;
  if (p.mono) o.mono = true;
  if (p.all) o.all = true;
  if (p.contrast !== undefined) o.gamma = 0.35 + (p.contrast / 100) * 0.8;
  if (p.dotSize !== undefined) o.size = p.dotSize / 100;
  if (p.density !== undefined) o.density = p.density / 100;
  if (p.steps !== undefined) o.steps = Math.round(p.steps);
  return o;
}

/** A stable string for a look, for effect dependencies and memo keys. */
export const lookKey = (o: LookOptions) => JSON.stringify(o);

/** Split LookProps out of a props object. */
export function pickLook<P extends LookProps>(p: P): LookProps {
  const { look, chars, mono, all, contrast, dotSize, density, steps } = p;
  return { look, chars, mono, all, contrast, dotSize, density, steps };
}
