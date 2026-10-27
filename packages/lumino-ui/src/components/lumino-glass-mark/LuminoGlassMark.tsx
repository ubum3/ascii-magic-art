"use client";
/*
 * LuminoGlassMark: the liquid-glass brandmark from LuminoChrome on its own, sized like
 * a logo, on a transparent background. Its top moves with slow waves, reflects the
 * brand gradient, catches a light sweep and tilts toward the pointer. The server HTML
 * (and the look without WebGL) is the flat mark in the brand gradient.
 */
import { useId, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { FILL_CANVAS } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { Brandmark } from "../../brand/Brandmark.js";
import { LUMINO_STOPS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { floatFieldTexture, smoothMarkSDF } from "../lumino-chrome/sdf.js";
import { GLASS_MARK } from "./glsl.js";

/** The mark's margin in its square, as a share of the side: room for the ripples and glow, and where the fallback sits. */
export const GLASS_MARK_PADDING = 0.2;

export interface LuminoGlassMarkProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Width and height of the square box: px or any CSS length. Default 240. */
  size?: number | string;
  /** Freezes the animation. Default false. */
  paused?: boolean;
  /** Animation speed. Default 1. */
  speed?: number;
  /** How much the surface moves, 0 (still) to 1 (as in LuminoChrome). Default 1. */
  ripple?: number;
  /** How far reflections follow the pointer, 0 to 1. Default 1. */
  tilt?: number;
  /** The rippled metal around the mark, 0 (just the mark) to 1 (the rings it has in LuminoChrome). Default 1. */
  rings?: number;
  /** The glow off the edge, 0 to 1. Default 1. */
  glow?: number;
  /** Render resolution, 0.25 to 1, as a share of the box's device pixels. Default 1. */
  quality?: number;
  /** Highest device pixel ratio to render at. Default 2. */
  dpr?: number;
  /** Accessible name. Default "Lumino". Pass "" to make it decoration. */
  label?: string;
}

const LAYER: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };

/** The brandmark as liquid glass, like the one rising out of LuminoChrome. */
export function LuminoGlassMark({
  size = 240, paused, speed, ripple = 1, rings = 1, tilt = 1, glow = 1, quality = 1, dpr = 2, label = "Lumino", style, ...rest
}: LuminoGlassMarkProps) {
  const live = useRef({ ripple, rings, tilt, glow });
  live.current = { ripple, rings, tilt, glow };
  const gradient = `lumino-glass-${useId().replace(/[^\w-]/g, "")}`;
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: GLASS_MARK_PADDING });
    const prog = link(gl, GLASS_MARK(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl);
    const field = floatFieldTexture(gl, smoothMarkSDF(sdf, 3, 3), sdf.width, sdf.height);
    const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
    return {
      draw({ time, width, height, pointer }) {
        const o = live.current;
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform1f(prog.u.uRipple!, clamp01(o.ripple));
        gl.uniform1f(prog.u.uTilt!, clamp01(o.tilt));
        gl.uniform1f(prog.u.uRings!, clamp01(o.rings));
        gl.uniform1f(prog.u.uGlow!, clamp01(o.glow));
        bindTexture(gl, 0, palette, prog.u.uPalette);
        bindTexture(gl, 1, field, prog.u.uField);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(prog.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(field);
      },
    };
  }, { paused, speed, quality, dpr });
  const fade = (on: boolean): CSSProperties => ({ opacity: on ? 1 : 0, transition: "opacity 600ms ease" });
  const inset = `${GLASS_MARK_PADDING * 100}%`, side = `${(1 - 2 * GLASS_MARK_PADDING) * 100}%`;
  return (
    <div
      data-lumino-glass-mark=""
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      {...rest}
      style={{ position: "relative", width: size, aspectRatio: "1", ...style }}
    >
      <Brandmark tight fill={`url(#${gradient})`} style={{ ...LAYER, inset: "auto", left: inset, top: inset, width: side, height: side, ...fade(!ready) }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="1" y2="1">
            {LUMINO_STOPS.map(([c, p]) => <stop key={c} offset={p} stopColor={c} />)}
          </linearGradient>
        </defs>
      </Brandmark>
      <div ref={boxRef} aria-hidden="true" style={{ ...LAYER, ...fade(ready) }}>
        <canvas ref={canvasRef} style={FILL_CANVAS} />
      </div>
    </div>
  );
}
