"use client";
/*
 * LuminoOrb: a glass orb off to one side (right on desktop, above the card on
 * phones) over a dark, warm nebula. The brandmark turns slowly inside it as a
 * refracted caustic with chromatic dispersion, the rim shimmers with a thin-film
 * iridescence in brand colours, and the orb casts a soft caustic pool of light.
 * The middle stays a calm, dark pool for the sign-in card.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS as C } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { cardHalfSize } from "../lumino-chrome/layout.js";
import { floatFieldTexture, smoothMarkSDF } from "../lumino-chrome/sdf.js";
import { ORB } from "./glsl.js";
import { orbPlace } from "./layout.js";

export interface LuminoOrbProps extends LuminoBackgroundProps {
  /** How far the mark turns inside the orb, 0 (faces you, still) to 1 (swings about 60 degrees each way). Default 0.8. */
  turn?: number;
}

/** The desktop orb as CSS: dark ground, warm nebula, a glassy disc with an iridescent rim and a highlight. */
const FALLBACK = [
  // The highlight, upper left on the glass.
  `radial-gradient(3.4vh 2vh at 76.6% 33%, #fff6f0bb, transparent 100%)`,
  // The mark's glow and the focused light inside, low right.
  `radial-gradient(circle 10vh at 82% 47%, ${C.peach}30, transparent 100%)`,
  `radial-gradient(circle 6vh at 88% 52%, ${C.peach}40, transparent 100%)`,
  // The glass body, warm inside, with a lavender and peach rim.
  `radial-gradient(circle 24vh at 82% 45%, ${C.wine}aa 0%, ${C.coral}55 55%, ${C.wine}88 80%, ${C.lavender}99 94%, ${C.peach}77 98.5%, transparent 100%)`,
  // The caustic pool below and the warm nebula around it.
  `radial-gradient(14vh 4vh at 86% 76%, ${C.peach}44, transparent 100%)`,
  `radial-gradient(40vh 36vh at 72% 16%, ${C.coral}38, transparent 100%)`,
  `radial-gradient(40vh 30vh at 66% 100%, ${C.coral}38, transparent 100%)`,
  `radial-gradient(40% 50% at 100% 70%, ${C.wine}66, transparent 100%)`,
  `radial-gradient(40% 45% at 0% 0%, ${C.blue}33, transparent 100%)`,
  `radial-gradient(35% 40% at 0% 100%, ${C.indigo}55, transparent 100%)`,
  `radial-gradient(70% 60% at 50% 50%, ${C.ground}, #0b0a0e 100%)`,
].join(", ");

/** A glass orb with the brandmark caught inside as a slowly turning refracted caustic. */
export function LuminoOrb({ turn = 0.8, paused, speed, quality = 0.6, dpr, ...frame }: LuminoOrbProps) {
  const turnRef = useRef(turn);
  turnRef.current = turn;
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, ORB(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl);
    const field = floatFieldTexture(gl, smoothMarkSDF(sdf, 1, 2), sdf.width, sdf.height);
    return {
      draw({ time, width, height, cssWidth, cssHeight, pointer }) {
        const place = orbPlace(width / height);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform3f(prog.u.uOrb!, place.x, place.y, place.r);
        gl.uniform2f(prog.u.uCard!, ...cardHalfSize(cssWidth, cssHeight));
        gl.uniform1f(prog.u.uTurn!, Math.max(0, Math.min(1, turnRef.current)));
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
