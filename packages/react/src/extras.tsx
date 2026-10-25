"use client";
/*
 * ascii-magic-art-react/extras: pieces made from data, as React components.
 *
 *   <AsciiSpec spec={logoSpec} />                       a logo from `ama-studio brand`
 *   <AsciiSpec spec={{ kind: "progress", cols: 40 }} state={{ value: 0.4 }} />
 *   <AsciiClip src="/intro.amc" />                      a clip from `ama-studio convert`
 *   <AsciiSequence pieces={[logo, dashboard]} kind="melt" />
 *   <AsciiWebcam cols={80} />                           the camera, live
 *
 * Every one renders through AsciiPlayer, so looks, size, speed and the rest work
 * the same as for library pieces.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Frame, PieceModule } from "ascii-magic-art/lib/types.js";
import {
  fromSpec, readClipHeader, splitFrames, clipPiece, sequence, cellsFromPixels, buildPalette, cellsFrame, gridSize,
  type Spec, type State, type SequenceOptions, type TransitionKind,
} from "ascii-magic-art-extras";
import { AsciiPlayer, type AsciiPlayerProps } from "./client/AsciiPlayer.js";

export type {
  Spec, State, SequenceOptions, TransitionKind, BrandSpec, TextSpec, ImageSpec, ProgressSpec, SparklineSpec, TickerSpec, CelebrateSpec,
  BrandEffect, BrandIdle, TextEffect,
} from "ascii-magic-art-extras";
export {
  fromSpec, sequence, mixFrames, TRANSITIONS, cellsFromPixels, buildPalette, BRAND_EFFECTS, BRAND_IDLES, TEXT_EFFECTS,
} from "ascii-magic-art-extras";

type PlayerProps = Omit<AsciiPlayerProps, "piece">;

/** A short, stable hash of a string, so a changed spec restarts the player. */
function shortHash(s: string): string {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * A spec as a piece module, made once per spec (compared by its JSON). Data kinds
 * read `state` on every frame, so changing it never restarts playback.
 */
export function useSpecPiece(spec: Spec | string, state?: State): PieceModule {
  const json = typeof spec === "string" ? spec : JSON.stringify(spec);
  const live = useRef(state);
  live.current = state;
  return useMemo(() => {
    const base = fromSpec(json);
    const meta = { ...base.meta, slug: `${base.meta.slug}-${shortHash(json)}` };
    return Object.freeze({ meta, default: () => { const d = base.default(); return (t: number) => d(t, live.current); } });
  }, [json]);
}

export interface AsciiSpecProps extends PlayerProps {
  /** A spec: JSON from ama-studio, or an object (see ascii-magic-art-extras). */
  spec: Spec | string;
  /** For data kinds (progress, sparkline, ticker, celebrate): what to draw now. */
  state?: State;
}

/** Plays a spec: a logo, animated text, a progress bar, a sparkline, a ticker, a picture. */
export function AsciiSpec({ spec, state, ...rest }: AsciiSpecProps) {
  const piece = useSpecPiece(spec, state);
  return <AsciiPlayer piece={piece} {...rest} />;
}

/** Raw-deflate bytes inflated with the browser's DecompressionStream. */
async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Decode .amc clip bytes in the browser. */
export async function loadClip(bytes: ArrayBuffer | Uint8Array): Promise<PieceModule> {
  const { header, body } = readClipHeader(bytes);
  const frames = splitFrames(new TextDecoder().decode(await inflateRaw(body)), header.frames);
  return clipPiece({ header, frames }) as PieceModule;
}

/** Fetch and decode a clip. undefined until it has loaded; error if it failed. */
export function useClip(src: string | ArrayBuffer | Uint8Array): { piece?: PieceModule; error?: unknown } {
  const [state, setState] = useState<{ piece?: PieceModule; error?: unknown }>({});
  useEffect(() => {
    let cancelled = false;
    const bytes = typeof src === "string" ? fetch(src).then((r) => { if (!r.ok) throw new Error(`${src}: ${r.status}`); return r.arrayBuffer(); }) : Promise.resolve(src);
    bytes.then(loadClip).then(
      (piece) => { if (!cancelled) setState({ piece }); },
      (error: unknown) => { if (!cancelled) setState({ error }); },
    );
    return () => { cancelled = true; };
  }, [src]);
  return state;
}

export interface AsciiClipProps extends PlayerProps {
  /** A URL to an .amc file, or its bytes. */
  src: string | ArrayBuffer | Uint8Array;
}

/** Plays an .amc clip (a video or GIF made into ASCII by `ama-studio convert`). */
export function AsciiClip({ src, ...rest }: AsciiClipProps) {
  const { piece, error } = useClip(src);
  useEffect(() => { if (error) rest.onError?.(error); }, [error]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!piece) return <span data-ama="" role="img" aria-label={rest.label ?? "ASCII clip, loading"} aria-busy="true" />;
  return <AsciiPlayer piece={piece} ssr={false} {...rest} />;
}

export interface AsciiSequenceProps extends PlayerProps, SequenceOptions {
  /** Pieces or specs, played one after another. */
  pieces: (PieceModule | Spec)[];
  state?: State;
}

/** Pieces one after another, with a transition between each (dissolve, wipes, melt, scramble, iris). */
export function AsciiSequence({ pieces, hold, kind, duration, loop, state, ...rest }: AsciiSequenceProps) {
  const live = useRef(state);
  live.current = state;
  const key = JSON.stringify([pieces.map((p) => ("kind" in p ? p : p.meta.slug)), hold, kind, duration, loop]);
  const piece = useMemo(() => {
    const mods = pieces.map((p) => ("kind" in p ? fromSpec(p) : p));
    const s = sequence(mods as Parameters<typeof sequence>[0], { hold, kind, duration, loop });
    const meta = { ...s.meta, slug: `sequence-${shortHash(key)}` };
    return Object.freeze({ meta, default: () => { const d = s.default(); return (t: number) => d(t, live.current); } });
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return <AsciiPlayer piece={piece as PieceModule} {...rest} />;
}

export interface AsciiWebcamProps extends PlayerProps {
  /** Width in cells. Default 80. */
  cols?: number;
  /** Square pixel cells (sharper colour) or text cells (for looks). Default true. */
  square?: boolean;
  /** Palette size. Default 32. */
  colors?: number;
  /** Mirror like a selfie camera. Default true. */
  mirror?: boolean;
  /** getUserMedia video constraints. */
  constraints?: MediaTrackConstraints;
}

/**
 * The camera, as ASCII, live. Asks for camera permission when it mounts and
 * stops the camera when it unmounts. Nothing leaves the page.
 */
export function AsciiWebcam({ cols = 80, square = true, colors = 32, mirror = true, constraints, ...rest }: AsciiWebcamProps) {
  const [piece, setPiece] = useState<PieceModule>();
  useEffect(() => {
    let cancelled = false, stream: MediaStream | undefined, raf = 0;
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    let latest: Frame = "";
    let palette: string[] | undefined, keyed: Record<string, string> = {}, n = 0;
    navigator.mediaDevices.getUserMedia({ video: constraints ?? true }).then(async (s) => {
      stream = s;
      if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = s;
      await video.play();
      const [w, h] = gridSize(video.videoWidth || 640, video.videoHeight || 480, cols, square);
      canvas.width = w; canvas.height = h;
      const grab = () => {
        if (!ctx) return;
        ctx.save();
        if (mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
        ctx.drawImage(video, 0, 0, w, h);
        ctx.restore();
        const px = ctx.getImageData(0, 0, w, h).data;
        if (!palette || n++ % 45 === 0) palette = buildPalette([px], colors); // follow the light, now and then
        const cells = cellsFromPixels(px, w, h, { palette });
        keyed = cells.palette;
        latest = { ...cellsFrame(cells), palette: cells.palette } as Frame;
        raf = requestAnimationFrame(grab);
      };
      grab();
      const meta = {
        slug: `webcam-${w}x${h}`, name: "Webcam", category: "extras", note: "", tags: ["extras", "webcam"],
        cols: w, rows: h, fps: 30, palette: keyed,
        ...(square ? { cell: "square" as const } : {}),
      };
      setPiece(Object.freeze({ meta, default: () => () => latest }));
    }, (e: unknown) => { if (!cancelled) rest.onError?.(e); });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [cols, square, colors, mirror, JSON.stringify(constraints)]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!piece) return <span data-ama="" role="img" aria-label={rest.label ?? "Camera as ASCII art, starting"} aria-busy="true" />;
  return <AsciiPlayer piece={piece} ssr={false} {...rest} />;
}
