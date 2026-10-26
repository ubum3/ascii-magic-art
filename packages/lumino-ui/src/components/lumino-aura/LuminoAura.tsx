"use client";
/*
 * LuminoAura: brand-gradient aurora curtains with the brandmark as a rim of glass light
 * low on the right. Also the reference background: it uses every shared helper
 * (BackgroundFrame, useGLScene, link, paletteTexture, markSDFTexture, BRAND_GLSL).
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { AURA } from "./glsl.js";

export type LuminoAuraProps = LuminoBackgroundProps;

/** Aurora curtains in the brand gradient, with the brandmark as a rim of glass light. */
export function LuminoAura({ paused, speed, quality = 0.5, dpr, ...frame }: LuminoAuraProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, AURA(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    return {
      draw({ time, width, height, pointer }) {
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
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
  return <BackgroundFrame {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
