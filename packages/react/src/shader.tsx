"use client";
/*
 * ascii-magic-art-react/shader: a WebGPU shader, as ASCII.
 *
 *   import { Shader, Aurora, FilmGrain } from "shaders/react";
 *   import { AsciiShader } from "ascii-magic-art-react/shader";
 *
 *   <AsciiShader cols={100} colors={24} fallback={<AsciiArt piece="aurora" />}>
 *     <Shader><Aurora /><FilmGrain /></Shader>
 *   </AsciiShader>
 *
 * You bring the shader (the `shaders` package, or any element that renders a
 * <canvas>); this package does not depend on it. The shader draws into a hidden
 * canvas that sits over the art, and each frame is read back into cells.
 *
 * - Telemetry: <Shader> reports usage to shaders.com unless told not to, so it is
 *   given disableTelemetry (and an sRGB colour space, which is what a 2D canvas
 *   reads) unless you pass `telemetry`.
 * - Without WebGPU (or when the shader says it is unavailable) the fallback shows.
 *   On the server, and until the first frame is read, the fallback shows too.
 */
import { Children, cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from "react";
import { gridSize } from "ascii-magic-art-extras";
import { AsciiPlayer, type AsciiPlayerProps } from "./client/AsciiPlayer.js";
import { usePixelsPiece, type PixelSource } from "./hooks/usePixelsPiece.js";

export { usePixelsPiece, type PixelSource, type PixelsOptions } from "./hooks/usePixelsPiece.js";

export interface AsciiShaderProps extends Omit<AsciiPlayerProps, "piece"> {
  /** One element that renders a <canvas>: a <Shader> tree from shaders/react. */
  children: ReactElement;
  /** Width in cells. Default 80. */
  cols?: number;
  /** Height in cells. Default 16:9 of the width. */
  rows?: number;
  /** Square pixel cells (sharper colour) or text cells (for looks). Default true. */
  square?: boolean;
  /** Palette size. Default 32. */
  colors?: number;
  /** A colour the shader is composited over where it is transparent. Default none: transparent is empty. */
  bg?: string;
  /** Shown on the server, while the GPU starts, and when WebGPU is unavailable. */
  fallback?: ReactNode;
  /** Let the hidden shader receive the pointer, for shaders that follow the cursor. */
  interactive?: boolean;
  /** Leave the shader's telemetry and colour space as they are. Default false: telemetry off, sRGB. */
  telemetry?: boolean;
  /** Called once if WebGPU is unavailable, with the reason. */
  onUnavailable?: (reason: unknown) => void;
}

type Gpu = "checking" | "ready" | "unavailable";

/** Whether this browser can hand out a WebGPU adapter. */
async function hasWebGPU(): Promise<boolean> {
  const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu;
  if (!gpu) return false;
  try { return !!(await gpu.requestAdapter()); } catch { return false; }
}

/** A WebGPU shader played as ASCII art, with a fallback where there is no WebGPU. */
export function AsciiShader({
  children, cols = 80, rows, square = true, colors = 32, bg, fallback, interactive = false, telemetry = false, onUnavailable, ...rest
}: AsciiShaderProps) {
  const [gpu, setGpu] = useState<Gpu>("checking");
  const host = useRef<HTMLDivElement>(null);
  const said = useRef(false);
  const unavailable = useCallback((reason: unknown) => {
    setGpu("unavailable");
    if (!said.current) { said.current = true; onUnavailable?.(reason); }
  }, [onUnavailable]);

  useEffect(() => {
    let cancelled = false;
    hasWebGPU().then((ok) => { if (!cancelled) (ok ? setGpu("ready") : unavailable("no WebGPU adapter")); });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [w, h] = rows ? [cols, rows] : gridSize(16, 9, cols, square);
  const source = useMemo<PixelSource | undefined>(() => gpu !== "ready" ? undefined : {
    cols: w, rows: h,
    draw(ctx) {
      const canvas = host.current?.querySelector("canvas");
      if (!canvas || !canvas.width || !canvas.height) return false;
      ctx.drawImage(canvas, 0, 0, w, h);
    },
  }, [gpu, w, h]);
  const piece = usePixelsPiece(source, { square, colors, bg, slug: "shader", name: "Shader" });

  const child = Children.only(children);
  const shader = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, {
      style: { width: "100%", height: "100%", ...(child.props.style as object | undefined) },
      ...(telemetry ? {} : { disableTelemetry: true, colorSpace: child.props.colorSpace ?? "srgb" }),
      onUnavailable: (reason: unknown) => {
        (child.props.onUnavailable as ((r: unknown) => void) | undefined)?.(reason);
        unavailable(reason);
      },
    })
    : child;

  const label = rest.label ?? "Shader as ASCII art";
  const shown = piece && gpu === "ready"
    ? <AsciiPlayer piece={piece} ssr={false} {...rest} />
    : fallback ?? (
      <span data-ama="" role="img" aria-label={gpu === "unavailable" ? `${label}, unavailable` : `${label}, starting`} aria-busy={gpu === "checking"}
        style={{ display: "block", width: "100%", aspectRatio: `${w} / ${square ? h : h * 2}` }} />
    );
  return (
    <div data-ama-shader="" style={{ position: "relative" }}>
      {shown}
      {gpu === "ready" && (
        // Kept in the viewport at full size: off screen or display:none, the shader is throttled or paused.
        <div ref={host} aria-hidden="true"
          style={{ position: "absolute", inset: 0, opacity: 0, pointerEvents: interactive ? "auto" : "none", zIndex: interactive ? 1 : undefined, overflow: "hidden" }}>
          {shader}
        </div>
      )}
    </div>
  );
}
