"use client";
/*
 * FerroBloom: glossy black ferrofluid with the brandmark as the magnet underneath.
 * The liquid stands up in a hex lattice of spikes along the mark's strokes, lit by
 * the brand gradient, and the pointer is a second, weaker magnet.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { FERRO } from "./glsl.js";
import { ferroLayout } from "./layout.js";

export interface FerroBloomProps extends LuminoBackgroundProps {
  /** How tall the spikes grow, in lattice cells. Default 2.4. */
  spikes?: number;
  /** The pointer raises spikes where it goes. Default true. */
  interactive?: boolean;
}

const { ground, peach, coral, plum, lavender } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(28% 40% at 82% 70%, ${peach}38, transparent 70%)`,
  `radial-gradient(35% 45% at 90% 95%, ${coral}30, transparent 70%)`,
  `radial-gradient(40% 50% at 70% 100%, ${lavender}22, transparent 70%)`,
  `radial-gradient(50% 50% at 0% 0%, ${plum}40, transparent 70%)`,
  ground,
].join(", ");

/** Black ferrofluid spiking up along the brandmark, lit by the brand gradient. */
export function FerroBloom({ spikes = 2.4, interactive = true, paused, speed, quality = 0.75, dpr, ...frame }: FerroBloomProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512, { padding: 0.18, spread: 150 });
    const prog = link(gl, FERRO(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    let pull = 0;
    return {
      draw({ time, dt, width, height, pointer, still }) {
        const aspect = width / height;
        const [mx, my, ms] = ferroLayout(aspect);
        // Ease the pointer's magnet in and out rather than switching it.
        const want = interactive && pointer.inside && !still ? 1 : 0;
        pull += (want - pull) * Math.min(1, dt * 3);
        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform3f(prog.u.uMarkAt!, mx, my, ms);
        gl.uniform3f(prog.u.uPointer!, pointer.x * aspect, pointer.y, pull);
        gl.uniform1f(prog.u.uSpike!, spikes);
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
