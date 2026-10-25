"use client";
/*
 * The markup every component shares: a wrapper that carries the typography, the
 * first frame in a <pre> (or an empty box of the right size), and the player
 * drawing its canvas next to it once the piece has loaded.
 */
import { useRef, type CSSProperties } from "react";
import type { LookOptions } from "ascii-magic-art/lib/types.js";
import { boxSize } from "../core/prerender.js";
import type { PieceSize } from "../core/resolve.js";
import { CSS, preStyle, wrapperStyle } from "../core/styles.js";
import { useAsciiPlayer, type PieceSource, type PlaybackOptions } from "../hooks/useAsciiPlayer.js";

export interface ViewProps {
  /** Font size: px as a number, or any CSS length. Default 12. */
  size?: number | string;
  /** Background colour behind the art. */
  bg?: string;
  /** Accessible name. Default "<piece name>, animated ASCII art". */
  label?: string;
  className?: string;
  style?: CSSProperties;
}

export interface PieceViewProps extends ViewProps, PlaybackOptions {
  source: PieceSource | undefined;
  sourceKey: string;
  pieceSize: PieceSize | undefined;
  /** The first frame as HTML; null or undefined draws an empty box until the player starts. */
  html: string | null | undefined;
  look: LookOptions;
  name?: string;
  /** Extra attributes for the wrapper (the hero marks itself). */
  wrapperProps?: Record<string, string>;
  /** Bump to restart the player from the current time (after a resize). */
  epoch?: number;
}

export function PieceView(p: PieceViewProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const { meta } = useAsciiPlayer(preRef, p.source, p.sourceKey, p.look, p, p.epoch);
  const square = !!p.pieceSize?.square;
  const box = p.html == null && p.pieceSize ? boxSize(p.pieceSize.cols, p.pieceSize.rows, square) : undefined;
  const name = meta?.name ?? p.name ?? p.sourceKey;
  return (
    <span
      data-ama=""
      role="img"
      aria-label={p.label ?? `${name}, animated ASCII art`}
      className={p.className}
      style={{ ...wrapperStyle(p.size ?? 12, p.bg), ...p.style }}
      {...p.wrapperProps}
    >
      <style>{CSS}</style>
      <pre
        ref={preRef}
        aria-hidden="true"
        suppressHydrationWarning
        style={preStyle(square, box)}
        dangerouslySetInnerHTML={{ __html: p.html ?? "" }}
      />
    </span>
  );
}
