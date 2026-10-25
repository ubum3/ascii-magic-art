/// <reference path="../types/pieces.d.ts" preserve="true" />
/*
 * ascii-magic-art-react/kit: everything for writing your own pieces in TypeScript.
 * Safe to import anywhere (no React, no DOM).
 *
 *   import { Grid, palette, definePiece } from "ascii-magic-art-react/kit";
 *   export default definePiece({ slug: "hello", cols: 30, rows: 5, palette: palette(["#7ee787"]) }, () => {
 *     const g = new Grid(30, 5);
 *     return (t) => { g.clear(); g.text(2, 2, "hello " + Math.floor(t), "0"); return g.frame(); };
 *   });
 */
import type { DrawFn, PieceMeta, PieceModule } from "ascii-magic-art/lib/types.js";

export * from "ascii-magic-art/lib/kit.js";
export { restyle, withLook, LOOKS } from "ascii-magic-art/runtime/glyphs.js";
export { frameHTML, frameText } from "ascii-magic-art/runtime/player.js";
export type { DrawFn, Frame, LookName, LookOptions, Palette, PieceMeta, PieceModule } from "ascii-magic-art/lib/types.js";

/** What a custom piece has to say about itself: its name and size. The rest has defaults. */
export type CustomMeta = Pick<PieceMeta, "slug" | "cols" | "rows"> & Partial<Omit<PieceMeta, "slug" | "cols" | "rows">>;

/**
 * Make a piece module from meta and a create function. create() is called once per
 * player and returns draw(t): seconds to a frame of exactly cols x rows characters.
 * Keep draw(t) pure in t, so the server and the browser draw the same first frame.
 */
export function definePiece<M extends CustomMeta>(meta: M, create: () => DrawFn): PieceModule<PieceMeta & M> {
  const full = { name: meta.slug, category: "custom", note: "", tags: [], fps: 24, ...meta } as PieceMeta & M;
  return Object.freeze({ meta: full, default: create });
}
