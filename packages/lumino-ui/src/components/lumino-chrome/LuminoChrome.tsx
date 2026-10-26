"use client";
/*
 * LuminoChrome: a liquid-chrome sea reflecting the brand gradient, with the brandmark
 * rising out of the metal as a bevelled relief, low on the right, sending ripples off
 * its blades. The middle stays a calm, darker pool for content.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS as C } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { CHROME } from "./glsl.js";
import { cardHalfSize, chromeMarkPlace } from "./layout.js";
import { floatFieldTexture, smoothMarkSDF } from "./sdf.js";

export interface LuminoChromeProps extends LuminoBackgroundProps {
  /** How much the sea still moves in the middle, 0 (glassy still) to 1 (as much as the edges). Default 0.15. */
  calm?: number;
}

/** A dark chrome sheen with warm and cool strips, close to the shader's look. */
const FALLBACK = [
  `radial-gradient(30% 34% at 80% 78%, ${C.peach}30, transparent 70%)`,
  `linear-gradient(162deg, transparent 52%, ${C.coral}38 60%, transparent 66%, ${C.lavender}22 74%, transparent 80%)`,
  `linear-gradient(18deg, transparent 20%, ${C.blue}30 30%, transparent 40%)`,
  `radial-gradient(70% 60% at 50% 50%, ${C.ground}, #0b0a0e 100%)`,
].join(", ");

/** A liquid-chrome sea with the brandmark rising out of it as a bevelled relief. */
export function LuminoChrome({ calm = 0.15, paused, speed, quality = 0.6, dpr, ...frame }: LuminoChromeProps) {
  const calmRef = useRef(calm);
  calmRef.current = calm;
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, CHROME(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl);
    const field = floatFieldTexture(gl, smoothMarkSDF(sdf, 3, 3), sdf.width, sdf.height);
    return {
      draw({ time, width, height, cssWidth, cssHeight, pointer }) {
        const place = chromeMarkPlace(width / height);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform3f(prog.u.uPlace!, place.x, place.y, place.size);
        gl.uniform2f(prog.u.uCard!, ...cardHalfSize(cssWidth, cssHeight));
        gl.uniform1f(prog.u.uCalm!, Math.max(0, Math.min(1, calmRef.current)));
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
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
