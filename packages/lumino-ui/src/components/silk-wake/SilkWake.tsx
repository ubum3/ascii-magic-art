"use client";
/*
 * SilkWake: translucent silk ribbons drift across at the brand's 139deg and part
 * around an invisible brandmark, which shows only as the gap they leave and a rim of
 * light where they wrap its strokes. The pointer pushes the silk aside.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { SILK } from "./glsl.js";
import { silkLayout } from "./layout.js";

export interface SilkWakeProps extends LuminoBackgroundProps {
  /** How many ribbons, 3 to 14. Default 11. */
  ribbons?: number;
  /** The pointer pushes the silk aside. Default true. */
  interactive?: boolean;
}

const { ground, peach, coral, plum, blue, lavender } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(30% 45% at 86% 50%, ${ground}, transparent 80%)`,
  `linear-gradient(139deg, transparent 38%, ${peach}26 48%, ${coral}22 56%, ${plum}30 64%, ${blue}2a 72%, ${lavender}22 80%, transparent 90%)`,
  ground,
].join(", ");

/** Silk ribbons flowing around the hidden brandmark. */
export function SilkWake({ ribbons = 11, interactive = true, paused, speed, quality = 0.75, dpr, ...frame }: SilkWakeProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: 0.15, spread: 96 });
    const prog = link(gl, SILK(markSpreadDefine(sdf), Math.max(3, Math.min(14, Math.round(ribbons)))));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const hand = { x: 0, y: 0, a: 0 };
    return {
      draw({ time, dt, width, height, pointer, still }) {
        const aspect = width / height;
        const [mx, my, ms] = silkLayout(aspect);
        const want = interactive && pointer.inside && !still ? 1 : 0;
        hand.a += (want - hand.a) * Math.min(1, dt * 2);
        hand.x += (pointer.x * aspect - hand.x) * Math.min(1, dt * 5);
        hand.y += (pointer.y - hand.y) * Math.min(1, dt * 5);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform3f(prog.u.uMarkAt!, mx, my, ms);
        gl.uniform2f(prog.u.uPointer!, hand.x, hand.y);
        gl.uniform1f(prog.u.uStir!, hand.a);
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
