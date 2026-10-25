/*
 * The first frame as HTML, worked out without a DOM so it can be sent from the
 * server: visitors see the art before any JS runs, and nothing shifts when the
 * canvas takes over. Pure in t, so the server and the client agree.
 */
import type { LookOptions, PieceModule } from "ascii-magic-art/lib/types.js";
import { frameHTML } from "ascii-magic-art/runtime/player.js";
import { restyle } from "ascii-magic-art/runtime/glyphs.js";
import { CELL_W } from "ascii-magic-art/runtime/canvas.js";

/** Above this much HTML a first frame is not worth sending; an empty box of the right size goes instead. */
export const MAX_PRERENDER = 48_000;

/** The look a player uses for this piece: the piece's own tuning under the caller's options. */
export function lookFor(mod: PieceModule, look: LookOptions = {}): LookOptions {
  const m = mod.meta;
  return { ...(m.dots || {}), ...(m.cell === "square" ? { lift: false } : {}), ...look };
}

/**
 * HTML for the frame at t0, or null when the piece should get a box instead:
 * square-cell pictures (thousands of colour runs) and very large frames.
 * Shape looks (dots, squares, dither) come out as their nearest characters.
 */
export function firstFrameHTML(mod: PieceModule, look: LookOptions = {}, t0 = 0): string | null {
  const m = mod.meta;
  if (m.cell === "square") return null;
  const l = lookFor(mod, look);
  const name = l.chars ? undefined : l.look ?? m.look;
  let f = mod.default()(t0);
  if (l.chars || (name && name !== "original") || l.mono) f = restyle(f, m.palette, { ...l, look: name });
  const html = frameHTML(f, (typeof f !== "string" && f.palette) || m.palette);
  return html.length > MAX_PRERENDER ? null : html;
}

/** The size of a piece in em of the font size, the same box the canvas fills. */
export function boxSize(cols: number, rows: number, square: boolean) {
  return { width: `${+(cols * CELL_W).toFixed(3)}em`, height: `${+(rows * (square ? CELL_W : 1)).toFixed(3)}em` };
}
