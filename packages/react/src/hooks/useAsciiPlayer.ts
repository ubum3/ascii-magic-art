"use client";
/*
 * useAsciiPlayer: plays a piece into a <pre> with the runtime's canvas player.
 * The player puts a <canvas> right after the <pre> and hides the <pre>, so the
 * <pre> must not have React-managed `display` or `line-height`.
 *
 * One player per <pre>, whatever happens: every effect run takes a `cancelled`
 * flag, so a piece that finishes loading after the props changed, the component
 * unmounted, or Strict Mode re-ran the effect never starts a second loop.
 */
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Frame, LookOptions, PieceMeta, PieceModule } from "ascii-magic-art/lib/types.js";
import { play } from "ascii-magic-art/runtime/player.js";
import { lookKey } from "../core/look.js";
import { useReducedMotion } from "./useReducedMotion.js";

/** A piece module, or a function that loads one. */
export type PieceSource = PieceModule | (() => Promise<PieceModule>);

export interface PlaybackOptions {
  /** Playback speed, 1 is normal. */
  speed?: number;
  /** Show one frame, no animation. */
  still?: boolean;
  /** Hold the current frame; playback resumes from it. */
  paused?: boolean;
  /** Rewrite the <pre> every frame instead of drawing a canvas: selectable text, slower. */
  dom?: boolean;
  /** Cap the frame rate below the piece's own. */
  maxFps?: number;
  /** Start at this many seconds into the piece. */
  t0?: number;
  /** Called with every frame drawn and its time in seconds. */
  onFrame?: (frame: Frame, t: number) => void;
  /** Called once the piece has loaded and drawn its first frame. */
  onReady?: (meta: PieceMeta) => void;
  onError?: (error: unknown) => void;
}

export type PlayerStatus = "loading" | "ready" | "error";

export interface AsciiPlayerControls {
  status: PlayerStatus;
  meta: PieceMeta | undefined;
  error: unknown;
  /** Start the player again from the current time (after a layout change, say). */
  restart: () => void;
  /** Seconds into the piece of the last frame drawn. */
  time: () => number;
}

/**
 * Play `source` into `preRef`. `sourceKey` names the piece: playback restarts when
 * it changes, so pass the slug (or meta.slug), not something new every render.
 */
export function useAsciiPlayer(
  preRef: RefObject<HTMLPreElement | null>,
  source: PieceSource | undefined,
  sourceKey: string,
  look: LookOptions,
  opts: PlaybackOptions = {},
  /** Bump to restart from the current time, like restart(). */
  epoch = 0,
): AsciiPlayerControls {
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [meta, setMeta] = useState<PieceMeta>();
  const [error, setError] = useState<unknown>();
  const [tick, setTick] = useState(0);
  const reduced = useReducedMotion();
  const lastT = useRef<number | null>(null);
  const playedKey = useRef(sourceKey);
  // Callbacks and the source are read through refs, so new closures don't restart playback.
  const live = useRef({ source, opts });
  live.current = { source, opts };

  const { speed = 1, still = false, paused = false, dom = false, maxFps } = opts;
  const lk = lookKey(look);

  useEffect(() => {
    const pre = preRef.current, src = live.current.source;
    if (!pre || !src) return;
    // A new piece starts from its own t0, not from where the last one was.
    if (playedKey.current !== sourceKey) { playedKey.current = sourceKey; lastT.current = null; }
    let cancelled = false, stop: (() => void) | undefined;
    (typeof src === "function" ? src() : Promise.resolve(src)).then(
      (mod) => {
        if (cancelled) return;
        stop = play(pre, mod, {
          speed,
          // undefined, not false: the runtime then checks prefers-reduced-motion itself before the hook has
          still: still || paused || reduced || undefined,
          dom,
          maxFps,
          look: JSON.parse(lk) as LookOptions,
          t0: lastT.current ?? live.current.opts.t0 ?? 0,
          onFrame: (f, t) => { lastT.current = t; live.current.opts.onFrame?.(f, t); },
        });
        setMeta(mod.meta);
        setError(undefined);
        setStatus("ready");
        live.current.opts.onReady?.(mod.meta);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e);
        setStatus("error");
        live.current.opts.onError?.(e);
      },
    );
    return () => { cancelled = true; stop?.(); };
  }, [preRef, sourceKey, lk, speed, still, paused, reduced, dom, maxFps, tick, epoch]);

  const restart = useCallback(() => setTick((n) => n + 1), []);
  const time = useCallback(() => lastT.current ?? live.current.opts.t0 ?? 0, []);
  return { status, meta, error, restart, time };
}
