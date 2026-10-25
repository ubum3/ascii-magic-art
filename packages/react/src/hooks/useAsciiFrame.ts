"use client";
/*
 * useAsciiFrame: a piece's frames as React state, for when you want the text
 * itself rather than a canvas: a spinner in a status bar, art inside your own
 * markup, a terminal-style UI. Re-renders at the piece's frame rate, so keep it
 * for small pieces; AsciiPlayer is far cheaper for big ones.
 */
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Frame, PieceModule } from "ascii-magic-art/lib/types.js";
import { withLook } from "ascii-magic-art/runtime/glyphs.js";
import { frameHTML, frameText } from "ascii-magic-art/runtime/player.js";
import { lookKey, pickLook, toLook, type LookProps } from "../core/look.js";
import { useReducedMotion } from "./useReducedMotion.js";

export interface AsciiFrameOptions extends LookProps {
  /** Start at this many seconds. Default 0. */
  t0?: number;
  /** false holds the current frame. Default true. */
  playing?: boolean;
  speed?: number;
  /** Cap the frame rate below the piece's own. */
  fps?: number;
  /** Pause while this element is off screen. */
  ref?: RefObject<Element | null>;
}

export interface AsciiFrame {
  frame: Frame;
  /** The frame as plain text. */
  text: string;
  /** The frame as HTML with colour spans, for dangerouslySetInnerHTML on a <pre>. */
  html: string;
  /** Seconds into the piece. */
  t: number;
}

export function useAsciiFrame(piece: PieceModule, opts: AsciiFrameOptions = {}): AsciiFrame {
  const { t0 = 0, playing = true, speed = 1, fps, ref } = opts;
  const look = toLook(pickLook(opts)), lk = lookKey(look);
  const reduced = useReducedMotion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- lk stands for look
  const draw = useMemo(() => withLook(piece.default(), piece.meta.palette, look), [piece, lk]);
  const [state, setState] = useState(() => ({ frame: draw(t0), t: t0 }));
  const tRef = useRef(t0);

  useEffect(() => {
    setState({ frame: draw(tRef.current), t: tRef.current });
    if (!playing || reduced || piece.meta.still || typeof requestAnimationFrame === "undefined") return;
    let raf = 0, prev = 0, last = 0, visible = true;
    const step = 1000 / Math.min(piece.meta.fps || 24, fps || 60);
    const io = ref?.current && typeof IntersectionObserver !== "undefined"
      ? new IntersectionObserver((es) => { visible = es[0]?.isIntersecting ?? true; })
      : null;
    if (io && ref?.current) io.observe(ref.current);
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      if (!visible || document.hidden) { prev = now; return; }
      if (prev) tRef.current += ((now - prev) / 1000) * speed;
      prev = now;
      if (now - last < step) return;
      last = now;
      setState({ frame: draw(tRef.current), t: tRef.current });
    };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); io?.disconnect(); };
  }, [draw, playing, reduced, speed, fps, ref, piece]);

  const palette = (typeof state.frame !== "string" && state.frame.palette) || piece.meta.palette;
  const html = useMemo(() => frameHTML(state.frame, palette), [state.frame, palette]);
  return { frame: state.frame, text: frameText(state.frame), html, t: state.t };
}
