"use client";
/*
 * HalftoneTide: lumino.io's dotted motif as a background. A fine grid of round
 * dots on the ground swells and brightens under slow, blurred tides of brand
 * light, coloured by the light under them, over a faint glow of the same light
 * (bokeh through a perforated glass screen). A large brandmark surfaces in the
 * dots, low on the left (at the bottom on phones), and every `tideEvery` seconds
 * a bright tide sweeps through it. One fragment shader, see glsl.ts.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { TIDE } from "./glsl.js";

export interface HalftoneTideProps extends LuminoBackgroundProps {
  /** Distance between dots, in CSS pixels. Default 10. */
  spacing?: number;
  /** The dot grid: "hex" (staggered rows) or "square". Default "hex". */
  shape?: "hex" | "square";
  /** Seconds between the bright tides that sweep through the brandmark. Default 10. */
  tideEvery?: number;
  /** Swell the dots near the pointer. Default true. */
  interactive?: boolean;
}

const { ground, peach, coral, plum, blue, lavender } = LUMINO_COLORS;

/**
 * The look without WebGL: blobs of brand light seen through a perforated screen
 * of the ground colour, so the holes become dots coloured by the light behind them.
 */
const TIDE_FALLBACK = [
  `radial-gradient(circle at 50% 50%, transparent 1.9px, ${ground}e6 2.7px) 0 0 / 10px 10px`,
  `radial-gradient(ellipse 50% 45% at 50% 50%, ${ground}, transparent 80%)`,
  `radial-gradient(40% 45% at 14% 80%, ${peach}cc, transparent 70%)`,
  `radial-gradient(35% 40% at 38% 95%, ${coral}bb, transparent 70%)`,
  `radial-gradient(40% 45% at 88% 12%, ${blue}cc, transparent 70%)`,
  `radial-gradient(35% 35% at 65% 4%, ${lavender}99, transparent 70%)`,
  `radial-gradient(60% 60% at 50% 50%, ${plum}99, transparent 75%)`,
  ground,
].join(", ");

/** The mark's square (centre x, y and side, in box-height units): low left on wide boxes, at the bottom on tall ones. */
function markBox(aspect: number): [number, number, number] {
  const wide: [number, number, number] = [0.27, 0.24, 0.85];
  const tall: [number, number, number] = [0.5 * aspect, 0.12, Math.min(1.25 * aspect, 0.6)];
  const k = Math.max(0, Math.min(1, (aspect - 0.75) / 0.35));
  const w = k * k * (3 - 2 * k);
  return [0, 1, 2].map((i) => tall[i]! + (wide[i]! - tall[i]!) * w) as [number, number, number];
}

/** A dot grid swelling under tides of brand light, with the brandmark surfacing in the dots. */
export function HalftoneTide({
  spacing = 10,
  shape = "hex",
  tideEvery = 10,
  interactive = true,
  paused,
  speed,
  quality = 1,
  dpr,
  ...frame
}: HalftoneTideProps) {
  // The scene reads these live, so changing them doesn't rebuild the GL program.
  const props = useRef({ spacing, shape, tideEvery, interactive });
  props.current = { spacing, shape, tideEvery, interactive };
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, TIDE(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    let hover = 0; // the pointer's pull, eased in and out
    return {
      draw({ time, dt, width, height, cssWidth, cssHeight, pointer, still }) {
        const live = props.current;
        hover += ((live.interactive && pointer.inside && !still ? 1 : 0) - hover) * Math.min(1, dt * 4 || 0);
        const [mx, my, ms] = markBox(cssWidth / cssHeight);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uCss!, cssWidth, cssHeight);
        gl.uniform1f(prog.u.uCssPerPx!, cssWidth / width);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform1f(prog.u.uSpacing!, Math.max(4, live.spacing));
        gl.uniform1f(prog.u.uHex!, live.shape === "square" ? 0 : 1);
        gl.uniform1f(prog.u.uTideEvery!, Math.max(3, live.tideEvery));
        gl.uniform3f(prog.u.uPointer!, pointer.x * cssWidth, pointer.y * cssHeight, hover);
        gl.uniform4f(prog.u.uMarkBox!, mx, my, ms, 0);
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
  }, { paused, speed, quality, dpr, stillTime: tideEvery * 0.45 + 1.5 });
  return <BackgroundFrame {...frame} fallback={TIDE_FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
