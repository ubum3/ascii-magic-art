"use client";
import { useCallback } from "react";
import { pickLook, toLook, type LookProps } from "../core/look.js";
import { loadPiece, sizeOf, type PieceRef } from "../core/resolve.js";
import type { PlaybackOptions } from "../hooks/useAsciiPlayer.js";
import { AsciiPlayer } from "./AsciiPlayer.js";
import { PieceView, type ViewProps } from "./PieceView.js";

export interface AsciiArtProps extends ViewProps, LookProps, PlaybackOptions {
  /** Any piece by name (typed: your editor completes all 634), or a piece module. */
  piece: PieceRef;
  /** Render the first frame into the HTML when it is known (default true). */
  ssr?: boolean;
  /**
   * The first frame as HTML, worked out on the server. The AsciiArt from
   * "ascii-magic-art-react/server" fills this in; you don't need to.
   */
  prerendered?: string | null;
}

/**
 * Plays any piece by name. The piece loads as its own small chunk; until it
 * arrives an empty box holds its exact size, so nothing moves. For the first
 * frame in the server HTML as well, use AsciiArt from "ascii-magic-art-react/server"
 * in a Server Component, or pass a module.
 */
export function AsciiArt({ piece, prerendered, ...rest }: AsciiArtProps) {
  if (typeof piece !== "string") return <AsciiPlayer piece={piece} {...rest} />;
  return <SlugArt slug={piece} prerendered={rest.ssr === false ? null : prerendered} {...rest} />;
}

function SlugArt({ slug, prerendered, ...rest }: Omit<AsciiArtProps, "piece"> & { slug: Extract<PieceRef, string> }) {
  const source = useCallback(() => loadPiece(slug), [slug]);
  return (
    <PieceView
      {...rest}
      source={source}
      sourceKey={slug}
      pieceSize={sizeOf(slug)}
      html={prerendered}
      look={toLook(pickLook(rest))}
    />
  );
}
