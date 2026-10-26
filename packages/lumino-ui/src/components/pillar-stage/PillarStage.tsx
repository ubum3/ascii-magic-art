"use client";
/*
 * PillarStage: the brandmark as the whole stage. Its blades are tall light pillars
 * rising from the bottom corners and leaning in to meet in a small star over the
 * content, and its base is a horizon arc under it, so the content sits in the dark
 * space the mark frames. One analytic pass, no textures beyond the palette.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { PILLARS } from "./glsl.js";

export interface PillarStageProps extends LuminoBackgroundProps {
  /** Brightness of the pillars, arc and star. Default 1. */
  intensity?: number;
  /** How far the pillars bow outward, 0 (straight) to 1. Default 0.5. */
  bow?: number;
}

export interface StageLayout {
  apex: [number, number];
  footL: [number, number];
  footR: [number, number];
  /** Pillar width at the foot. */
  width: number;
  bow: number;
  /** The base arc's circle: centre x, centre y, radius. */
  arc: [number, number, number];
}

/** The stage for a box of this aspect, in height units (x scaled by aspect, y up). */
export function stageLayout(aspect: number, bow = 0.5): StageLayout {
  const portrait = aspect < 0.8;
  const inset = portrait ? 0.02 : 0.07 * aspect;
  const width = portrait ? Math.max(0.07, aspect * 0.2) : 0.17;
  const radius = aspect * 0.9 + 0.4, top = portrait ? 0.1 : 0.15;
  return {
    apex: [aspect / 2, portrait ? 0.95 : 0.93],
    footL: [inset, -0.05],
    footR: [aspect - inset, -0.05],
    width,
    bow: Math.max(0, Math.min(1, bow)) * (portrait ? 0.04 : 0.14),
    arc: [aspect / 2, top - radius, radius],
  };
}

const { ground, peach, coral, blue, lavender, plum } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(3% 4% at 50% 7%, #fff8, transparent 70%)`,
  `linear-gradient(64deg, transparent 6%, ${coral}40 10%, ${peach}30 13%, transparent 18%)`,
  `linear-gradient(-64deg, transparent 6%, ${blue}40 10%, ${lavender}30 13%, transparent 18%)`,
  `radial-gradient(90% 22% at 50% 100%, ${plum}88, transparent 70%)`,
  ground,
].join(", ");

/** The brandmark as a stage: two leaning light pillars and a horizon arc framing the content. */
export function PillarStage({ intensity = 1, bow = 0.5, paused, speed, quality = 0.5, dpr, ...frame }: PillarStageProps) {
  const settings = useRef({ intensity, bow });
  settings.current = { intensity, bow };
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const prog = link(gl, PILLARS);
    const palette = paletteTexture(gl);
    const pointer = { x: 0.5, y: 0.5 };
    return {
      draw({ time, dt, width, height, pointer: pt }) {
        const s = settings.current, L = stageLayout(width / height, s.bow);
        const k = 1 - Math.exp(-(dt || 0.016) * 2);
        pointer.x += ((pt.inside ? pt.x : 0.5) - pointer.x) * k;
        pointer.y += ((pt.inside ? pt.y : 0.5) - pointer.y) * k;
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform2f(prog.u.uPointer!, pointer.x, pointer.y);
        gl.uniform1f(prog.u.uIntensity!, s.intensity);
        gl.uniform2f(prog.u.uApex!, ...L.apex);
        gl.uniform2f(prog.u.uFootL!, ...L.footL);
        gl.uniform2f(prog.u.uFootR!, ...L.footR);
        gl.uniform1f(prog.u.uWidth!, L.width);
        gl.uniform1f(prog.u.uBow!, L.bow);
        gl.uniform3f(prog.u.uArc!, ...L.arc);
        bindTexture(gl, 0, palette, prog.u.uPalette);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(prog.program);
        gl.deleteTexture(palette);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame {...frame} fallback={FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
