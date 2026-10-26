"use client";
/*
 * GlassPrismRays: the brandmark as a glass prism high above the content, lit from
 * behind. Light leaks around it and through the gaps between its shapes and streams
 * out as volumetric shafts that split into the brand gradient as they fan down the
 * sides. Two passes: what shines (a quarter of the size), then a radial blur toward
 * the mark with the sharp glass mark on top.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { EMIT, RAYS } from "./glsl.js";

export interface GlassPrismRaysProps extends LuminoBackgroundProps {
  /** Brightness of the light shafts. Default 1. */
  intensity?: number;
  /** How far the shafts reach, 0.3 to 1. Default 1. */
  rayLength?: number;
}

const { ground, peach, coral, blue, plum } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(18% 16% at 50% 14%, ${peach}66, transparent 70%)`,
  `conic-gradient(from 150deg at 50% 14%, transparent, ${coral}30 8%, transparent 16%, transparent 34%, ${blue}30 42%, transparent 50%)`,
  `radial-gradient(70% 60% at 50% 100%, ${plum}55, transparent 70%)`,
  ground,
].join(", ");

/** Where the mark sits and how big its square is, in height units (x scaled by aspect), for a box of this shape. */
export function prismLayout(aspect: number): { center: [number, number]; scale: number } {
  const scale = aspect < 0.8 ? Math.min(0.3, aspect * 0.62) : 0.34;
  return { center: [aspect / 2, aspect < 0.8 ? 0.87 : 0.85], scale };
}

/** A glass brandmark lit from behind, throwing prismatic light shafts down the sides. */
export function GlassPrismRays({ intensity = 1, rayLength = 1, paused, speed, quality = 0.5, dpr, ...frame }: GlassPrismRaysProps) {
  const settings = useRef({ intensity, rayLength });
  settings.current = { intensity, rayLength };
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const spread = markSpreadDefine(sdf);
    const emit = link(gl, EMIT(spread)), rays = link(gl, RAYS(spread));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const target = gl.createTexture()!, fbo = gl.createFramebuffer()!;
    let tw = 0, th = 0;
    const size = (w: number, h: number) => {
      tw = Math.max(32, Math.round(w / 4));
      th = Math.max(32, Math.round(h / 4));
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tw, th, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    };
    const common = (p: typeof emit, w: number, h: number, time: number) => {
      const { center, scale } = prismLayout(w / h);
      gl.useProgram(p.program);
      gl.uniform2f(p.u.uResolution!, w, h);
      gl.uniform1f(p.u.uTime!, time);
      gl.uniform2f(p.u.uCenter!, center[0], center[1]);
      gl.uniform1f(p.u.uScale!, scale);
      bindTexture(gl, 0, palette, p.u.uPalette);
      bindTexture(gl, 1, mark, p.u.uMark);
    };
    return {
      resize: size,
      draw({ time, width, height }) {
        if (!tw) size(width, height);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
        gl.viewport(0, 0, tw, th);
        common(emit, width, height, time);
        drawFullscreen(gl);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, width, height);
        common(rays, width, height, time);
        bindTexture(gl, 2, target, rays.u.uEmit);
        gl.uniform1f(rays.u.uIntensity!, settings.current.intensity);
        gl.uniform1f(rays.u.uLength!, Math.max(0.3, Math.min(1, settings.current.rayLength)));
        gl.uniform1f(rays.u.uCalm!, 0.45);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(emit.program);
        gl.deleteProgram(rays.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
        gl.deleteTexture(target);
        gl.deleteFramebuffer(fbo);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame {...frame} fallback={FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
