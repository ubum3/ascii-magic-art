"use client";
/*
 * BrandmarkGalaxy: a tilted spiral galaxy low on one side, cropped by the edges,
 * whose nucleus is the brandmark. The mark is made of thousands of twinkling
 * stars; streamers leave it and unwind along the two arms into the disk.
 * Two passes: a full-screen glow (core, arms, dust lanes) and ~40k additive
 * point stars placed in the vertex shader from gl_VertexID, with no CPU work a frame.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkPoints } from "../../brand/mark.js";
import { GALAXY_GLOW, GALAXY_STARS_FS, GALAXY_STARS_VS } from "./glsl.js";
import { galaxyLayout } from "./layout.js";

export interface BrandmarkGalaxyProps extends LuminoBackgroundProps {
  /** The galaxy's size, relative to the default. Default 1. */
  galaxySize?: number;
  /** Stars in all, 8k to 80k. Default 40000. */
  stars?: number;
}

const FALLBACK = [
  `radial-gradient(14% 18% at 20% 72%, ${LUMINO_COLORS.peach}60, transparent 70%)`,
  `radial-gradient(45% 30% at 22% 72%, ${LUMINO_COLORS.coral}35, transparent 72%)`,
  `radial-gradient(70% 50% at 25% 75%, ${LUMINO_COLORS.indigo}aa, transparent 75%)`,
  LUMINO_COLORS.ground,
].join(", ");

/** A spiral galaxy whose nucleus is the brandmark, its arms unwinding from it. */
export function BrandmarkGalaxy({ paused, speed, quality = 0.75, dpr, galaxySize = 1, stars = 40000, ...frame }: BrandmarkGalaxyProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const total = Math.round(Math.max(8000, Math.min(80000, stars)));
    const markN = Math.round(total * 0.16), streamN = Math.round(total * 0.2);

    const glow = link(gl, GALAXY_GLOW);
    const dots = link(gl, GALAXY_STARS_FS, GALAXY_STARS_VS);
    const palette = paletteTexture(gl);

    // The mark's fill samples as an RG32F texture, read by index in the vertex shader.
    const W = 256, H = Math.ceil(markN / W);
    const data = new Float32Array(W * H * 2);
    data.set(brandmarkPoints(markN, { padding: 0, seed: 7 }));
    const points = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, points);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, W, H, 0, gl.RG, gl.FLOAT, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    const empty = gl.createVertexArray();

    const shared = (u: Record<string, WebGLUniformLocation | null>, width: number, height: number, time: number) => {
      const { galaxy, shape, markSide } = galaxyLayout(width / height, galaxySize);
      gl.uniform2f(u.uResolution!, width, height);
      gl.uniform1f(u.uTime!, time);
      gl.uniform3f(u.uGalaxy!, ...galaxy);
      gl.uniform2f(u.uShape!, ...shape);
      gl.uniform1f(u.uMarkSide!, markSide);
    };

    return {
      draw({ time, width, height, cssWidth }) {
        gl.viewport(0, 0, width, height);
        gl.disable(gl.BLEND);
        gl.useProgram(glow.program);
        shared(glow.u, width, height, time);
        bindTexture(gl, 0, palette, glow.u.uPalette);
        drawFullscreen(gl);

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        gl.useProgram(dots.program);
        shared(dots.u, width, height, time);
        gl.uniform1f(dots.u.uPointScale!, width / cssWidth);
        gl.uniform1i(dots.u.uMarkN!, markN);
        gl.uniform1i(dots.u.uStreamN!, streamN);
        bindTexture(gl, 0, palette, dots.u.uPalette);
        bindTexture(gl, 1, points, dots.u.uPoints);
        gl.bindVertexArray(empty);
        gl.drawArrays(gl.POINTS, 0, total);
        gl.disable(gl.BLEND);
      },
      dispose() {
        gl.deleteProgram(glow.program);
        gl.deleteProgram(dots.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(points);
        gl.deleteVertexArray(empty);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
