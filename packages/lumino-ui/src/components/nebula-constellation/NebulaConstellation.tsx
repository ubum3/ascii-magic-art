"use client";
/*
 * NebulaConstellation: slow nebula clouds in wine, plum and indigo with peach light
 * on their edges, and the brandmark as a constellation. Every 14 seconds its stars
 * drift together in a corner, glowing glass lines draw between them down the
 * mark's strokes, the strokes fill with faint glass light, and then it all
 * dissolves to form again somewhere else. One full-screen pass; the stars and
 * lines come in as uniforms (constellation.ts works them out).
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { constellationAt, MARK_SQUARE } from "./constellation.js";
import { NEBULA_CONSTELLATION } from "./glsl.js";

export interface NebulaConstellationProps extends LuminoBackgroundProps {
  /** The constellation's size, relative to the default. Default 1. */
  markSize?: number;
}

const FALLBACK = [
  `radial-gradient(40% 35% at 18% 28%, ${LUMINO_COLORS.wine}70, transparent 72%)`,
  `radial-gradient(45% 40% at 85% 75%, ${LUMINO_COLORS.indigo}aa, transparent 72%)`,
  `radial-gradient(30% 25% at 70% 20%, ${LUMINO_COLORS.coral}30, transparent 70%)`,
  `radial-gradient(50% 45% at 10% 90%, ${LUMINO_COLORS.plum}90, transparent 75%)`,
  LUMINO_COLORS.ground,
].join(", ");

/** A nebula where the brandmark forms as a constellation of glass lines, again and again. */
export function NebulaConstellation({ paused, speed, quality = 0.75, dpr, markSize = 1, ...frame }: NebulaConstellationProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, NEBULA_CONSTELLATION(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    return {
      draw({ time, width, height, pointer, still }) {
        const c = constellationAt(still ? 0 : time, width / height, markSize);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform3fv(prog.u.uStars!, c.stars);
        gl.uniform4fv(prog.u.uLines!, c.lines);
        gl.uniform1fv(prog.u.uLineAlpha!, c.lineAlpha);
        gl.uniform3f(prog.u.uMarkAt!, c.center[0], c.center[1], c.size);
        gl.uniform1f(prog.u.uSquare!, MARK_SQUARE);
        gl.uniform1f(prog.u.uFill!, c.fill);
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
