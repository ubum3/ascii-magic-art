"use client";
/*
 * GlobeDawn: the lumino.io dotted globe low on the screen, turning slowly, with the
 * brandmark rising behind its limb like a sun. The mark lights a crescent of dots
 * and the air along the limb; a few short soft rays fan out behind it.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { GLOBE_DAWN } from "./glsl.js";
import { globeLayout, riseAt } from "./layout.js";

export interface GlobeDawnProps extends LuminoBackgroundProps {
  /** The mark's size, relative to the default. Default 1. */
  markSize?: number;
  /** Dot rows on the globe, pole to pole. Default 150. */
  dots?: number;
}

const FALLBACK = [
  `radial-gradient(22% 30% at 64% 62%, ${LUMINO_COLORS.peach}55, transparent 70%)`,
  `radial-gradient(70% 45% at 32% 105%, ${LUMINO_COLORS.indigo}aa, transparent 72%)`,
  `radial-gradient(40% 30% at 60% 70%, ${LUMINO_COLORS.coral}40, transparent 70%)`,
  LUMINO_COLORS.ground,
].join(", ");

/** The dotted globe at dawn, with the brandmark rising behind it as the sun. */
export function GlobeDawn({ paused, speed, quality = 0.75, dpr, markSize = 1, dots = 150, ...frame }: GlobeDawnProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, GLOBE_DAWN(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    return {
      draw({ time, width, height, pointer, still }) {
        const { globe, sun } = globeLayout(width / height, markSize);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform3f(prog.u.uGlobe!, ...globe);
        gl.uniform3f(prog.u.uSun!, ...sun);
        gl.uniform1f(prog.u.uRise!, still ? 1 : riseAt(time));
        gl.uniform1f(prog.u.uDots!, dots);
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
