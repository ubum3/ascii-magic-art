"use client";
/*
 * DitherLens: the brand light dithered into chunky pixels, seen smooth, refracted
 * and glowing through a big frosted-glass brandmark. The mark sits on the left on
 * wide screens and at the top on tall ones, clear of a centred card.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture, rgb } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { DITHER_LENS } from "./glsl.js";

export interface DitherLensProps extends LuminoBackgroundProps {
  /** Size of a dither pixel, in CSS pixels. Default 6. */
  cell?: number;
  /** Tone steps between the ground and full light. Default 4. */
  levels?: number;
  /** Size of the glass mark, as a share of the box's short side. Default 0.74 (wide) and 0.8 (tall). */
  lensSize?: number;
}

const FALLBACK = [
  `radial-gradient(40% 55% at 22% 55%, ${LUMINO_COLORS.coral}40, transparent 70%)`,
  `radial-gradient(35% 45% at 12% 25%, ${LUMINO_COLORS.blue}55, transparent 70%)`,
  `radial-gradient(40% 50% at 92% 85%, ${LUMINO_COLORS.plum}70, transparent 70%)`,
  `repeating-conic-gradient(${LUMINO_COLORS.ground} 0 25%, #16141c 0 50%) 0 0 / 12px 12px`,
].join(", ");

/** The brand light dithered into pixels, smooth and glowing through a frosted-glass brandmark. */
export function DitherLens({ cell = 6, levels = 4, lensSize, paused, speed, quality = 1, dpr, ...frame }: DitherLensProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: 0.12, spread: 40 });
    const prog = link(gl, DITHER_LENS(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const ground = rgb(LUMINO_COLORS.ground);
    return {
      draw({ time, width, height, cssWidth, pointer }) {
        const aspect = width / height, ratio = width / cssWidth, wide = aspect >= 0.9;
        const size = (lensSize ?? (wide ? 0.74 : 0.8)) * Math.min(aspect, 1);
        // Wide: left of a centred card, a little low. Tall: above it.
        const lx = wide ? Math.min(size * 0.42, aspect * 0.5 - 0.3 - size * 0.45) + 0.02 : aspect * 0.5;
        const ly = wide ? 0.42 : 1 - size * 0.4;
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform1f(prog.u.uCell!, Math.max(2, cell * ratio));
        gl.uniform1f(prog.u.uLevels!, levels);
        gl.uniform3f(prog.u.uGround!, ground[0], ground[1], ground[2]);
        gl.uniform4f(prog.u.uLens!, lx, ly, size, wide ? -0.12 : 0);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        bindTexture(gl, 0, palette, prog.u.uPalette);
        bindTexture(gl, 1, mark, prog.u.uMark);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(prog.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
