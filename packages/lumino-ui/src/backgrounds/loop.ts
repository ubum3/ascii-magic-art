"use client";
// The render loop every canvas background shares: sizing, pausing, reduced motion and the pointer.
import { useEffect, useRef, useState, type RefObject } from "react";

/** What a scene gets each frame. */
export interface SceneFrame {
  /** Seconds of animation so far (scaled by `speed`, stopped while paused). */
  time: number;
  /** Seconds since the last frame (scaled by `speed`; 0 while paused). */
  dt: number;
  /** Canvas size in device pixels. */
  width: number;
  height: number;
  /** The box's size in CSS pixels. */
  cssWidth: number;
  cssHeight: number;
  /** The pointer in 0 to 1 box coordinates, y up (like gl_FragCoord), and whether it is over the box. */
  pointer: { x: number; y: number; inside: boolean };
  /** True for a single still frame (reduced motion). */
  still: boolean;
}

export interface Scene {
  draw(frame: SceneFrame): void;
  /** The canvas was resized (device pixels). */
  resize?(width: number, height: number): void;
  dispose?(): void;
}

export interface LoopOptions {
  paused?: boolean;
  speed?: number;
  /** Share of the device pixels to render, 0.25 to 1. Default 1. */
  quality?: number;
  /** Highest device pixel ratio. Default 1.5. */
  dpr?: number;
  /** With prefers-reduced-motion, the time of the one frame drawn. Default 6. */
  stillTime?: number;
  /** Track the pointer over the box. Default true. */
  pointer?: boolean;
}

/**
 * Run a canvas scene in a box: `setup` gets the context once (return null if the
 * context is missing or setup fails, and the fallback stays). The canvas follows
 * the box's size, the loop pauses off screen and in hidden tabs, and with reduced
 * motion one still frame is drawn. `ready` turns true after the first frame.
 */
export function useCanvasLoop<C>(
  getContext: (canvas: HTMLCanvasElement) => C | null,
  setup: (ctx: C, canvas: HTMLCanvasElement) => Scene | null,
  options: LoopOptions = {},
): { boxRef: RefObject<HTMLDivElement | null>; canvasRef: RefObject<HTMLCanvasElement | null>; ready: boolean } {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ready, setReady] = useState(false);
  const opts = useRef(options);
  opts.current = options;

  useEffect(() => {
    const box = boxRef.current, canvas = canvasRef.current;
    if (!box || !canvas) return undefined;
    const ctx = getContext(canvas);
    if (!ctx) return undefined;
    let scene: Scene | null = null;
    try {
      scene = setup(ctx, canvas);
    } catch (err) {
      console.warn("lumino-ui: background setup failed", err);
    }
    if (!scene) return undefined;
    const s: Scene = scene;

    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const pointer = { x: 0.5, y: 0.5, inside: false };
    const size = { w: 0, h: 0, cssW: 1, cssH: 1 };
    let raf = 0, last = 0, time = 0, onScreen = true, drewOnce = false, disposed = false;

    const frame = (dt: number): SceneFrame => ({
      time, dt, width: size.w, height: size.h, cssWidth: size.cssW, cssHeight: size.cssH, pointer, still,
    });
    const drawNow = (dt: number) => {
      if (!size.w || !size.h) return;
      try {
        s.draw(frame(dt));
      } catch (err) {
        console.warn("lumino-ui: background draw failed", err);
        stop();
        return;
      }
      if (!drewOnce) {
        drewOnce = true;
        setReady(true);
      }
    };
    const resize = () => {
      const r = box.getBoundingClientRect();
      const o = opts.current;
      const ratio = Math.min(window.devicePixelRatio || 1, o.dpr ?? 1.5) * Math.max(0.25, Math.min(1, o.quality ?? 1));
      const w = Math.max(1, Math.round(r.width * ratio)), h = Math.max(1, Math.round(r.height * ratio));
      size.cssW = Math.max(1, r.width);
      size.cssH = Math.max(1, r.height);
      if (w === size.w && h === size.h) return;
      size.w = canvas.width = w;
      size.h = canvas.height = h;
      s.resize?.(w, h);
      if (still || opts.current.paused) drawNow(0);
    };
    const tick = (now: number) => {
      raf = 0;
      if (disposed) return;
      const o = opts.current;
      const dt = last ? Math.min(0.1, (now - last) / 1000) * (o.paused ? 0 : o.speed ?? 1) : 0;
      last = now;
      time += dt;
      drawNow(dt);
      start();
    };
    const start = () => {
      if (!raf && !still && onScreen && !document.hidden) raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      last = 0;
    };

    if (still) time = opts.current.stillTime ?? 6;
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();
    const io = new IntersectionObserver(([e]) => {
      onScreen = !!e?.isIntersecting;
      if (onScreen) start();
      else stop();
    });
    io.observe(box);
    const onVisibility = () => (document.hidden ? stop() : start());
    document.addEventListener("visibilitychange", onVisibility);
    const onMove = (e: PointerEvent) => {
      const r = box.getBoundingClientRect();
      pointer.x = (e.clientX - r.left) / Math.max(1, r.width);
      pointer.y = 1 - (e.clientY - r.top) / Math.max(1, r.height);
      pointer.inside = pointer.x >= 0 && pointer.x <= 1 && pointer.y >= 0 && pointer.y <= 1;
    };
    const onLeave = () => {
      pointer.inside = false;
    };
    // The window, not the box: content on top of the background shouldn't hide the pointer from it.
    if (opts.current.pointer !== false) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", onLeave);
    }
    if (still) drawNow(0);
    else start();

    return () => {
      disposed = true;
      stop();
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
      try {
        s.dispose?.();
      } catch {
        /* the context may be gone already */
      }
    };
    // setup and getContext run once per mount; settings are read live from opts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { boxRef, canvasRef, ready };
}

/** useCanvasLoop with a WebGL2 context (alpha, premultiplied, no depth or antialias). */
export function useGLScene(setup: (gl: WebGL2RenderingContext, canvas: HTMLCanvasElement) => Scene | null, options?: LoopOptions) {
  return useCanvasLoop(
    (c) => c.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, powerPreference: "high-performance" }),
    setup,
    options,
  );
}

/** useCanvasLoop with a 2D context. */
export function use2DScene(setup: (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => Scene | null, options?: LoopOptions) {
  return useCanvasLoop((c) => c.getContext("2d"), setup, options);
}
