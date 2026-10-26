// Timing hooks for the perf page: GPU time per frame (WebGL2 timer queries) and CPU time in rAF callbacks.

const TIME_ELAPSED_EXT = 0x88bf;
const GPU_DISJOINT_EXT = 0x8fbb;

interface Timed {
  gl: WebGL2RenderingContext;
  canvas: HTMLCanvasElement;
  /** Queries begun and not yet read, oldest first. */
  pending: WebGLQuery[];
  active: WebGLQuery | null;
}

export interface Probe {
  /** GPU ms per frame, read back as queries finish. */
  gpu: number[];
  /** CPU ms per frame spent in rAF callbacks other than the probe's own. */
  cpu: number[];
  /** Whether any live WebGL2 context with a timer was seen. */
  hasTimer(): boolean;
  /** Whether a live WebGL2 context is on the page (with or without a timer). */
  sawWebGL(): boolean;
  /** Drop collected samples (between warm-up and measuring). */
  reset(): void;
  /** Read back finished queries; call once a frame. */
  poll(): void;
  /** The original requestAnimationFrame, for the page's own loop (not counted). */
  raf: typeof requestAnimationFrame;
  restore(): void;
}

/**
 * Patch getContext (to find WebGL2 contexts and their timer extension) and
 * requestAnimationFrame (to wrap each frame's callbacks in a timer query and a
 * CPU stopwatch). Only for the perf page: restore() puts both back.
 */
export function installProbe(): Probe {
  const proto = HTMLCanvasElement.prototype;
  const origGetContext = proto.getContext;
  const origRaf = window.requestAnimationFrame.bind(window);
  const timed: Timed[] = [];
  const exts = new WeakMap<WebGL2RenderingContext, unknown>();
  const all: { gl: WebGL2RenderingContext; canvas: HTMLCanvasElement }[] = [];
  const gpu: number[] = [], cpu: number[] = [];

  proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
    const ctx = (origGetContext as (...a: unknown[]) => RenderingContext | null).call(this, type, ...rest);
    if (type === "webgl2" && ctx && !exts.has(ctx as WebGL2RenderingContext)) {
      const gl = ctx as WebGL2RenderingContext;
      all.push({ gl, canvas: this });
      const ext = gl.getExtension("EXT_disjoint_timer_query_webgl2");
      exts.set(gl, ext);
      if (ext) timed.push({ gl, canvas: this, pending: [], active: null });
    }
    return ctx;
  } as typeof proto.getContext;

  const live = () => timed.filter((t) => t.canvas.isConnected && !t.gl.isContextLost());
  // Frames are keyed by the rAF timestamp, which every callback in a frame shares.
  // A timer query runs from one frame's first callback to the next one's: it only
  // counts GPU work submitted in between, so the idle gap costs nothing.
  let frameTs = -1, frameCpu = 0;
  const roll = (ts: number) => {
    if (ts === frameTs) return;
    if (frameTs >= 0) cpu.push(frameCpu);
    frameTs = ts;
    frameCpu = 0;
    for (const t of live()) {
      if (t.active) {
        t.gl.endQuery(TIME_ELAPSED_EXT);
        t.pending.push(t.active);
        t.active = null;
      }
      const q = t.gl.createQuery();
      if (!q) continue;
      t.gl.beginQuery(TIME_ELAPSED_EXT, q);
      t.active = q;
    }
  };

  window.requestAnimationFrame = (cb: FrameRequestCallback) =>
    origRaf((ts) => {
      roll(ts);
      const t0 = performance.now();
      try {
        cb(ts);
      } finally {
        frameCpu += performance.now() - t0;
      }
    });

  return {
    gpu,
    cpu,
    hasTimer: () => live().length > 0,
    sawWebGL: () => all.some((c) => c.canvas.isConnected && !c.gl.isContextLost()),
    reset() {
      gpu.length = 0;
      cpu.length = 0;
      frameTs = -1;
    },
    poll() {
      for (const t of live()) {
        const disjoint = t.gl.getParameter(GPU_DISJOINT_EXT);
        while (t.pending.length) {
          const q = t.pending[0]!;
          if (!t.gl.getQueryParameter(q, t.gl.QUERY_RESULT_AVAILABLE)) break;
          const ns = t.gl.getQueryParameter(q, t.gl.QUERY_RESULT) as number;
          if (!disjoint) gpu.push(ns / 1e6);
          t.gl.deleteQuery(q);
          t.pending.shift();
        }
      }
    },
    raf: origRaf,
    restore() {
      proto.getContext = origGetContext;
      window.requestAnimationFrame = origRaf;
      for (const t of timed) {
        if (t.gl.isContextLost()) continue;
        if (t.active) t.gl.endQuery(TIME_ELAPSED_EXT);
        for (const q of t.pending) t.gl.deleteQuery(q);
      }
      timed.length = 0;
      all.length = 0;
    },
  };
}

/** Mean and 95th percentile of a list (NaN when empty). */
export function stats(xs: readonly number[]): { avg: number; p95: number } {
  if (!xs.length) return { avg: NaN, p95: NaN };
  const s = [...xs].sort((a, b) => a - b);
  return { avg: s.reduce((a, b) => a + b, 0) / s.length, p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]! };
}
