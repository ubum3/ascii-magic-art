"use client";
/*
 * AsciiOverlay: shaders/react layers drawn at full resolution, filling the
 * container behind your content, with the shaders package's own GPU ASCII effect
 * on top. Unlike AsciiShader there is no readback: the glyphs are drawn on the GPU
 * in real fonts, so they stay sharp and can sit over the picture they come from.
 *
 *   ascii="off"      the layers as they are
 *   ascii="overlay"  the layers, with glyphs of the same layers blended on top
 *   ascii="full"     the layers turned into glyphs
 *
 * The effect sizes its cells against a 1080 px tall canvas; here cellSize is in
 * CSS pixels, converted from the box's measured height so glyphs stay one size.
 *
 * Where there is no WebGPU the canvas stays transparent and the CSS `fallback`
 * under it shows (also on the server, until the GPU starts).
 */
import { useEffect, useRef, useState, type ComponentProps, type CSSProperties, type ReactNode } from "react";
import { Shader, Ascii, SolidColor } from "shaders/react";

export type AsciiMode = "off" | "overlay" | "full";
type AsciiProps = ComponentProps<typeof Ascii>;

export interface AsciiOptions {
  /** off, overlay (glyphs over the picture) or full (only glyphs). */
  ascii?: AsciiMode;
  /** Glyphs from brightest to darkest. Default "@%#*+=-:.". */
  characters?: string;
  /** Cell height in CSS pixels. Default 16. */
  cellSize?: number;
  /** The glyphs' font. Default JetBrains Mono. */
  fontFamily?: AsciiProps["fontFamily"];
  /** Glyph size within its cell, 0 to 1. Default 1. */
  spacing?: number;
  /** Below 1 lifts dark areas to denser glyphs; above 1 thins them. Default 0.5. */
  gamma?: number;
  /** Behind the glyphs in full mode. Default #05030c. */
  backdrop?: string;
  /** How overlay glyphs mix with the picture. Default screen. */
  asciiBlend?: AsciiProps["blendMode"];
  /** Overlay glyph opacity, 0 to 1. Default 0.8. */
  asciiOpacity?: number;
}

export interface StageOptions extends AsciiOptions {
  /** Darken the art under your content: 0 (none) to 1 (black). Default 0. */
  dim?: number;
  /** Accessible name for the art. It is decoration by default. */
  label?: string;
  /** The stage needs a height: give it one with className or style. Default min-height 24rem. */
  className?: string;
  style?: CSSProperties;
  /** Your content, on top. */
  children?: ReactNode;
}

export interface AsciiOverlayProps extends StageOptions {
  /** shaders/react layers: a gradient, an <ImageTexture>, a <VideoTexture>, a stack of them. */
  layers: ReactNode;
  /** A CSS background shown where there is no WebGPU and until the GPU draws. */
  fallback?: string;
}

/** The stage props every background takes, so they can be split from the layer's own. */
export const STAGE_KEYS = [
  "ascii", "characters", "cellSize", "fontFamily", "spacing", "gamma", "backdrop", "asciiBlend", "asciiOpacity",
  "dim", "label", "className", "style", "children",
] as const satisfies readonly (keyof StageOptions)[];

/** Split a background's props into the stage's and its layer's. */
export function splitStage<P extends StageOptions>(props: P): [StageOptions, Omit<P, keyof StageOptions>] {
  const stage: Record<string, unknown> = {}, layer: Record<string, unknown> = { ...(props as Record<string, unknown>) };
  for (const k of STAGE_KEYS) if (k in layer) { stage[k] = layer[k]; delete layer[k]; }
  return [stage as StageOptions, layer as Omit<P, keyof StageOptions>];
}

export function AsciiOverlay({
  layers, fallback, ascii = "overlay", characters, cellSize = 16, fontFamily, spacing, gamma = 0.5, backdrop = "#05030c",
  asciiBlend = "screen", asciiOpacity = 0.8, dim = 0, label, className, style, children,
}: AsciiOverlayProps) {
  const root = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(400);
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => { const h = el.getBoundingClientRect().height; if (h > 0) setHeight(h); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Leave unset options out, so the effect keeps its own defaults.
  const glyphs = Object.fromEntries(Object.entries({ characters, cellSize: (cellSize * 1080) / height, fontFamily, spacing, gamma })
    .filter(([, v]) => v !== undefined));
  return (
    <div
      ref={root}
      className={className}
      style={{ position: "relative", overflow: "hidden", minHeight: "24rem", background: fallback, ...style }}
    >
      <div role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
        style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <Shader disableTelemetry style={{ width: "100%", height: "100%" }}>
          {ascii === "full" ? <SolidColor color={backdrop} /> : layers}
          {ascii !== "off" && (
            <Ascii {...glyphs} {...(ascii === "overlay" ? { blendMode: asciiBlend, opacity: asciiOpacity } : {})}>{layers}</Ascii>
          )}
        </Shader>
      </div>
      {dim > 0 && <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.min(1, dim)})`, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
