"use client";
/*
 * AsciiHero: a piece scaled to fill its container, behind your content.
 * The scale is pure CSS (container query units), so the server HTML already has
 * the right size; a ResizeObserver restarts the player after a resize so the
 * canvas redraws sharp at the new size.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { CELL_W } from "ascii-magic-art/runtime/canvas.js";
import { lookKey, pickLook, toLook, type LookProps } from "../core/look.js";
import { firstFrameHTML } from "../core/prerender.js";
import { loadPiece, sizeOf, type PieceRef } from "../core/resolve.js";
import type { PlaybackOptions } from "../hooks/useAsciiPlayer.js";
import { PieceView } from "./PieceView.js";

export interface AsciiHeroProps extends LookProps, PlaybackOptions {
  piece: PieceRef;
  /** cover fills the container edge to edge (cropping); contain shows the whole piece. Default cover. */
  fit?: "cover" | "contain";
  /** Opacity of the art, 0 to 1. Default 1. */
  opacity?: number;
  /** Darken the art under your content: 0 (none) to 1 (black). Default 0. */
  dim?: number;
  /** Background colour of the whole hero. */
  bg?: string;
  /** Render the first frame into the HTML when it is known (default true). */
  ssr?: boolean;
  /** Filled in by AsciiHero from "ascii-magic-art-react/server". */
  prerendered?: string | null;
  /** Accessible name for the art. It is decoration by default (hidden from screen readers). */
  label?: string;
  /** The hero needs a height: give it one with className or style. Default min-height 24rem. */
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

export function AsciiHero({ piece, fit = "cover", opacity = 1, dim = 0, bg, prerendered, label, className, style, children, ...rest }: AsciiHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [epoch, setEpoch] = useState(0);
  const isSlug = typeof piece === "string";
  const size = sizeOf(piece);
  const look = toLook(pickLook(rest));
  const lk = lookKey(look);
  const ssr = rest.ssr !== false;

  const moduleHTML = useMemo(
    () => (!isSlug && ssr ? firstFrameHTML(piece, look, rest.t0) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lk stands for look
    [piece, lk, ssr, rest.t0],
  );
  const slugSource = useCallback(() => loadPiece(piece as Extract<PieceRef, string>), [piece]);

  // Redraw at the new size once a resize settles. The first observation is the initial size.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let first = true, timer: ReturnType<typeof setTimeout> | undefined;
    const ro = new ResizeObserver(() => {
      if (first) { first = false; return; }
      clearTimeout(timer);
      timer = setTimeout(() => setEpoch((n) => n + 1), 150);
    });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, []);

  let fontSize = "12px";
  if (size) {
    const fx = `calc(100cqw / ${+(size.cols * CELL_W).toFixed(4)})`;
    const fy = `calc(100cqh / ${+(size.rows * (size.square ? CELL_W : 1)).toFixed(4)})`;
    fontSize = fit === "cover" ? `max(${fx}, ${fy})` : `min(${fx}, ${fy})`;
  }

  return (
    <div
      ref={rootRef}
      className={className}
      style={{ position: "relative", overflow: "hidden", containerType: "size", minHeight: "24rem", background: bg, ...style }}
    >
      <div
        aria-hidden={label ? undefined : true}
        style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", opacity }}
      >
        <PieceView
          {...rest}
          source={isSlug ? slugSource : piece}
          sourceKey={isSlug ? piece : piece.meta.slug}
          pieceSize={size}
          html={isSlug ? (ssr ? prerendered : null) : moduleHTML}
          look={look}
          name={isSlug ? undefined : piece.meta.name}
          label={label}
          size={fontSize}
          style={{ maxWidth: "none", overflow: "visible", flex: "none" }}
          wrapperProps={{ "data-ama-hero": "" }}
          epoch={epoch}
        />
      </div>
      {dim > 0 && <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.min(1, dim)})`, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
