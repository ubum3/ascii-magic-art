"use client";
/*
 * FieldLines: the brandmark as a magnet. Its stroke ends are poles, and the field
 * lines between them (exact contours of the field's stream function) bridge the gaps,
 * loop out into the dark and carry pulses of light. The pointer is a small bar magnet
 * that bends them. With `filings` the lines become ASCII iron filings.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { FIELD, MAX_POLES } from "./glsl.js";
import { fieldLayout, placePoles } from "./poles.js";

export interface FieldLinesProps extends LuminoBackgroundProps {
  /** Field lines per pole. Default 14. */
  lines?: number;
  /** Draw the field as ASCII iron filings (- / | \) instead of lines. Default false. */
  filings?: boolean;
  /** FILINGS: glyph height in CSS pixels. Default 14. */
  cell?: number;
  /** The pointer is a small magnet that bends the lines. Default true. */
  interactive?: boolean;
}

const { ground, peach, coral, blue, lavender } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(20% 26% at 25% 30%, ${peach}30, transparent 70%)`,
  `radial-gradient(40% 50% at 25% 72%, ${coral}20, transparent 70%)`,
  `radial-gradient(45% 55% at 20% 95%, ${blue}38, transparent 70%)`,
  `radial-gradient(40% 40% at 100% 0%, ${lavender}18, transparent 70%)`,
  ground,
].join(", ");

/** Glowing magnetic field lines between the brandmark's strokes, with pulses running along them. */
export function FieldLines({ lines = 14, filings = false, cell = 14, interactive = true, paused, speed, quality, dpr, ...frame }: FieldLinesProps) {
  // Thin lines want full resolution; filings are drawn per cell, so half is plenty.
  const q = quality ?? (filings ? 0.75 : 1);
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: 0.12, spread: 48 });
    const prog = link(gl, FIELD(markSpreadDefine(sdf), filings));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const poles = new Float32Array(MAX_POLES * 3);
    const hand = { x: 0.5, y: 0.5, a: 0, angle: 0 };
    return {
      draw({ time, dt, width, height, cssWidth, pointer, still }) {
        const aspect = width / height;
        const [mx, my, ms] = fieldLayout(aspect);
        poles.fill(0);
        poles.set(placePoles(mx, my, ms, lines));
        // The pointer's magnet eases in and follows behind the cursor, turning slowly.
        const want = interactive && pointer.inside && !still ? 1 : 0;
        const k = Math.min(1, dt * 4);
        hand.a += (want - hand.a) * Math.min(1, dt * 2);
        hand.x += (pointer.x * aspect - hand.x) * k;
        hand.y += (pointer.y - hand.y) * k;
        hand.angle = time * 0.4;
        if (hand.a > 0.01) {
          // A short bar magnet: equal and opposite poles, so its fade leaves no seam.
          const h = 0.02, n = lines * 0.6 * hand.a, cx = Math.cos(hand.angle) * h, cy = Math.sin(hand.angle) * h;
          poles.set([hand.x + cx, hand.y + cy, n, hand.x - cx, hand.y - cy, -n], 21);
        }
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform3f(prog.u.uMarkAt!, mx, my, ms);
        gl.uniform3fv(prog.u.uPoles!, poles);
        gl.uniform1f(prog.u.uLines!, lines);
        gl.uniform1f(prog.u.uCell!, cell * (width / cssWidth));
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
  }, { paused, speed, quality: q, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
