"use client";
/*
 * AccretionLens: the brandmark as a black hole. A dark glass horizon with a photon
 * ring along its outline, a thin accretion disk orbiting it (warm on the side
 * coming towards you, cool on the other), and space lensed to the mark's shape:
 * the far side of the disk is pulled up and over the mark, and the stars and dust
 * around it bend.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { ACCRETION_LENS } from "./glsl.js";
import { holeLayout } from "./layout.js";

export interface AccretionLensProps extends LuminoBackgroundProps {
  /** The hole's size, relative to the default. Default 1. */
  markSize?: number;
  /** How hard space bends around the mark. Default 1. */
  lensing?: number;
  /** The disk's tilt: 0 edge-on to 1 face-on. Default 0.24. */
  tilt?: number;
}

const FALLBACK = [
  `radial-gradient(18% 12% at 80% 32%, ${LUMINO_COLORS.peach}50, transparent 70%)`,
  `radial-gradient(34% 22% at 80% 32%, ${LUMINO_COLORS.coral}35, transparent 72%)`,
  `radial-gradient(50% 40% at 85% 30%, ${LUMINO_COLORS.indigo}90, transparent 75%)`,
  LUMINO_COLORS.ground,
].join(", ");

/** The brandmark as a black hole, with an accretion disk and space lensed to its shape. */
export function AccretionLens({ paused, speed, quality = 0.6, dpr, markSize = 1, lensing = 1, tilt = 0.24, ...frame }: AccretionLensProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const field = brandmarkSDF(256, { spread: 100 });
    const prog = link(gl, ACCRETION_LENS(markSpreadDefine(sdf), field.spread / field.width));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf), wide = markSDFTexture(gl, field);
    return {
      draw({ time, width, height, pointer }) {
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform3f(prog.u.uHole!, ...holeLayout(width / height, markSize));
        gl.uniform1f(prog.u.uMass!, 0.012 * lensing);
        gl.uniform1f(prog.u.uTilt!, Math.max(0.05, Math.min(1, tilt)));
        bindTexture(gl, 0, palette, prog.u.uPalette);
        bindTexture(gl, 1, mark, prog.u.uMark);
        bindTexture(gl, 2, wide, prog.u.uField);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(prog.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
        gl.deleteTexture(wide);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
