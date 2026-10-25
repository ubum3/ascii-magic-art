"use client";
/*
 * ascii-magic-art-react/rest: the 240 pieces of ascii.rest (by bas3line, MIT),
 * played by the same player as ours, so looks, size, speed and the rest work.
 *
 *   <AsciiRest piece="rust" look="dots" />          loads as its own chunk
 *   const rust = useRestPiece("night-coast");        the module, once loaded
 *
 * For the first frame in the server HTML too, use AsciiRest from
 * "ascii-magic-art-react/rest/server" in a Server Component.
 */
import { useCallback, useEffect, useState } from "react";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import { restPiece, restSize, isRestSlug, REST_CATALOG } from "ascii-magic-art-rest";
import { pickLook, toLook, type LookProps } from "./core/look.js";
import type { PlaybackOptions } from "./hooks/useAsciiPlayer.js";
import { PieceView, type ViewProps } from "./client/PieceView.js";

export { REST_CATALOG, restSlugs, restSize, isRestSlug } from "ascii-magic-art-rest";

/** "rust" or "rest-rust". */
const slugOf = (piece: string) => (piece.startsWith("rest-") ? piece : "rest-" + piece);

const NAMES = new Map(REST_CATALOG.map((r) => [r[0], r[1]]));
const cache = new Map<string, Promise<PieceModule>>();
/** One of their pieces as a module of ours, loaded once per slug. */
export function loadRestPiece(piece: string): Promise<PieceModule> {
  const slug = slugOf(piece);
  let p = cache.get(slug);
  if (!p) cache.set(slug, (p = restPiece(slug) as Promise<PieceModule>));
  return p;
}

export interface AsciiRestProps extends ViewProps, LookProps, PlaybackOptions {
  /** One of ascii.rest's pieces, by its name: "rust", "night-coast" (or "rest-rust"). */
  piece: string;
  /** The first frame as HTML, from the server component. */
  prerendered?: string | null;
}

/** Plays one of ascii.rest's pieces. Until it loads, an empty box holds its exact size. */
export function AsciiRest({ piece, prerendered, ...rest }: AsciiRestProps) {
  const slug = slugOf(piece);
  if (!isRestSlug(slug)) throw new Error(`ascii-magic-art-react: no ascii.rest piece called "${piece}"`);
  const source = useCallback(() => loadRestPiece(slug), [slug]);
  return (
    <PieceView name={NAMES.get(slug)} {...rest} source={source} sourceKey={slug} pieceSize={restSize(slug)} html={prerendered} look={toLook(pickLook(rest))} />
  );
}

/** One of their pieces as a module (undefined until it has loaded), for AsciiPlayer, sequences or your own player. */
export function useRestPiece(piece: string): { module?: PieceModule; error?: unknown } {
  const [s, set] = useState<{ module?: PieceModule; error?: unknown }>({});
  useEffect(() => {
    let live = true;
    set({});
    loadRestPiece(piece).then((module) => live && set({ module }), (error: unknown) => live && set({ error }));
    return () => { live = false; };
  }, [piece]);
  return s;
}
