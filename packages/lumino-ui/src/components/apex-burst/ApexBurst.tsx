"use client";
/*
 * ApexBurst: a PrismaticBurst that starts in the brandmark's heart, where the two
 * blades part over the base. The mark stands in the light: its shapes cast soft dark
 * wedges, a beam escapes up the slot between the blades, and the gaps over the base
 * throw rays down the sides, so straight below (where a card sits) stays in shadow.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { BRANDMARK, LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { BURST } from "./glsl.js";

export interface ApexBurstProps extends LuminoBackgroundProps {
  /** Brightness of the burst. Default 3. */
  intensity?: number;
  /** How many spokes the burst splits into (0 for a cloudy burst). Default 14. */
  rays?: number;
}

const PADDING = 0.12;

/** A point in the brandmark's viewBox as 0 to 1 coordinates (y up) of the square brandmarkSDF bakes with `padding`. */
export function markUV(x: number, y: number, padding = PADDING): [number, number] {
  const [bx, by, bw, bh] = BRANDMARK.bounds;
  const s = (1 - 2 * padding) / Math.max(bw, bh);
  return [x * s + (1 - bw * s) / 2 - bx * s, 1 - (y * s + (1 - bh * s) / 2 - by * s)];
}

/** The heart: the bottom of the slot between the blades, where the burst starts. */
export const HEART = markUV(1000, 893);

/** Where the heart sits and how big the mark's square is, in height units (x scaled by aspect). */
export function burstLayout(aspect: number): { heart: [number, number]; scale: number } {
  const portrait = aspect < 0.8;
  return { heart: [aspect / 2, portrait ? 0.85 : 0.83], scale: portrait ? Math.min(0.3, aspect * 0.58) : 0.35 };
}

const rotX = (a: number) => [1, 0, 0, 0, Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a)];
const rotY = (a: number) => [Math.cos(a), 0, -Math.sin(a), 0, 1, 0, Math.sin(a), 0, Math.cos(a)];
const rotZ = (a: number) => [Math.cos(a), Math.sin(a), 0, -Math.sin(a), Math.cos(a), 0, 0, 0, 1];
/** Column-major 3x3 multiply, a * b. */
function mul(a: number[], b: number[]): number[] {
  const o = new Array<number>(9);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 3 + r] = a[r]! * b[c * 3]! + a[3 + r]! * b[c * 3 + 1]! + a[6 + r]! * b[c * 3 + 2]!;
  return o;
}

const { ground, peach, coral, blue, plum } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(10% 9% at 50% 18%, ${peach}88, transparent 70%)`,
  `conic-gradient(from 180deg at 50% 18%, transparent 20%, ${coral}38 26%, transparent 32%, transparent 68%, ${blue}38 74%, transparent 80%)`,
  `radial-gradient(60% 40% at 50% 0%, ${plum}66, transparent 70%)`,
  ground,
].join(", ");

/** A prismatic light burst from inside the brandmark, cut into rays by its shapes. */
export function ApexBurst({ intensity = 3, rays = 14, paused, speed, quality = 0.5, dpr, ...frame }: ApexBurstProps) {
  const settings = useRef({ intensity, rays });
  settings.current = { intensity, rays };
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: PADDING });
    const prog = link(gl, BURST(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    return {
      draw({ time, width, height }) {
        const { heart, scale } = burstLayout(width / height);
        const phase = time * 0.35;
        const orient = mul(mul(rotZ(phase * 0.17), rotY(phase * 0.21)), rotX(phase * 0.31));
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform1f(prog.u.uPhase!, phase);
        gl.uniform1f(prog.u.uIntensity!, settings.current.intensity);
        gl.uniformMatrix3fv(prog.u.uOrient!, false, orient);
        gl.uniform2f(prog.u.uHeart!, heart[0], heart[1]);
        gl.uniform2f(prog.u.uHeartMark!, HEART[0], HEART[1]);
        gl.uniform1f(prog.u.uScale!, scale);
        gl.uniform1f(prog.u.uCalm!, 0.6);
        gl.uniform1f(prog.u.uRays!, Math.max(0, Math.round(settings.current.rays)));
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
  return <BackgroundFrame {...frame} fallback={FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
