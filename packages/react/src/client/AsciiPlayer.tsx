"use client";
import { useMemo } from "react";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import { pickLook, toLook, lookKey, type LookProps } from "../core/look.js";
import { firstFrameHTML } from "../core/prerender.js";
import type { PlaybackOptions } from "../hooks/useAsciiPlayer.js";
import { PieceView, type ViewProps } from "./PieceView.js";

export interface AsciiPlayerProps extends ViewProps, LookProps, PlaybackOptions {
  /** A piece module: `import * as torus from "ascii-magic-art/pieces/spinning-torus.js"`, or one from definePiece. */
  piece: PieceModule;
  /** Render the first frame into the HTML (default true). false sends an empty box of the right size. */
  ssr?: boolean;
}

/**
 * Plays a piece module you imported yourself. Never touches the 634-piece
 * registry, so a page only ships the pieces it uses. The first frame is in the
 * server HTML. Define custom pieces at module level: a new module object every
 * render would restart playback.
 */
export function AsciiPlayer({ piece, ssr = true, ...rest }: AsciiPlayerProps) {
  const look = toLook(pickLook(rest));
  const lk = lookKey(look);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lk stands for look
  const html = useMemo(() => (ssr ? firstFrameHTML(piece, look, rest.t0) : null), [piece, lk, ssr, rest.t0]);
  const m = piece.meta;
  return (
    <PieceView
      {...rest}
      source={piece}
      sourceKey={m.slug}
      pieceSize={{ cols: m.cols, rows: m.rows, square: m.cell === "square" }}
      html={html}
      look={look}
      name={m.name}
    />
  );
}
