"use client";
/*
 * LuminoShards: the brandmark shattered into a few hundred glass shards that orbit the
 * card in a loose ring, each spinning about its own axis, refracting a soft nebula of
 * the brand gradient with glowing edges and glints. Every cycle they pull back
 * together into a faint brandmark behind the card, hold, and burst out again.
 * All the motion is in the vertex shader; the CPU only sets uniforms.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture, type Program } from "../../backgrounds/gl.js";
import { LUMINO_COLORS as C } from "../../brand/brand.js";
import { brandmarkCanvas, brandmarkSDF } from "../../brand/mark.js";
import { cardHalfSize } from "../lumino-chrome/layout.js";
import { BACKDROP_FS, SHARDS_FS, SHARDS_VS } from "./glsl.js";
import { shardMesh } from "./mesh.js";

export interface LuminoShardsProps extends LuminoBackgroundProps {
  /** Lattice columns across the mark: more means smaller, more shards (32 is about 560). Read once on mount. Default 32. */
  density?: number;
  /** Seconds for one burst, orbit and reassembly. Default 13. */
  cycle?: number;
  /** How visible the reassembled mark is, 0 to 1. Default 0.5. */
  markOpacity?: number;
  /** Let the pointer push nearby shards. Default true. */
  interactive?: boolean;
  /** Seed for the shatter pattern. Read once on mount. Default 7. */
  seed?: number;
}

/** Nebula light at the edges in the brand gradient, around a dark middle. */
const FALLBACK = [
  `radial-gradient(40% 45% at 96% 100%, ${C.coral}48, transparent 70%)`,
  `radial-gradient(30% 35% at 80% 104%, ${C.peach}30, transparent 70%)`,
  `radial-gradient(45% 50% at 2% 0%, ${C.blue}48, transparent 70%)`,
  `radial-gradient(35% 40% at 18% -4%, ${C.lavender}22, transparent 70%)`,
  `radial-gradient(40% 50% at 0% 70%, ${C.plum}50, transparent 70%)`,
  `radial-gradient(40% 50% at 100% 25%, ${C.wine}40, transparent 70%)`,
  C.ground,
].join(", ");

/** The mark's padding in the square the shards are cut from. */
const PADDING = 0.05;

/** Glass shards of the brandmark orbiting the card, reassembling into the mark every cycle. */
export function LuminoShards({
  density = 32, cycle = 13, markOpacity = 0.5, interactive = true, seed = 7,
  paused, speed, quality = 0.85, dpr, ...frame
}: LuminoShardsProps) {
  const live = useRef({ cycle, markOpacity, interactive });
  live.current = { cycle, markOpacity, interactive };
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    // Rasterise the mark for the inside test (canvas y runs down; the mesh is y up).
    const N = 512;
    const alpha = brandmarkCanvas(N, N, { padding: PADDING }).getContext("2d")!.getImageData(0, 0, N, N).data;
    const inside = (x: number, y: number) => {
      const i = Math.min(N - 1, Math.floor(x * N)), j = Math.min(N - 1, Math.floor((1 - y) * N));
      return alpha[(j * N + i) * 4 + 3]! > 127;
    };
    const mesh = shardMesh(inside, { cols: density, seed });

    // The mark's distance field, to trim the reassembled shards to its outline.
    const sdf = brandmarkSDF(512, { padding: PADDING, spread: 24 });
    const spread = markSpreadDefine(sdf);
    const bg = link(gl, BACKDROP_FS(spread));
    const shards = link(gl, SHARDS_FS(spread), SHARDS_VS);
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const sizes = [2, 2, 3, 4];
    const buffers = [mesh.local, mesh.home, mesh.bary, mesh.rand].map((data, loc) => {
      const buf = gl.createBuffer()!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, sizes[loc]!, gl.FLOAT, false, 0, 0);
      return buf;
    });
    gl.bindVertexArray(null);
    let push = 0;

    const common = (p: Program, time: number, aspect: number, card: [number, number]) => {
      gl.useProgram(p.program);
      gl.uniform1f(p.u.uAspect!, aspect);
      gl.uniform1f(p.u.uTime!, time);
      gl.uniform2f(p.u.uCard!, card[0], card[1]);
      bindTexture(gl, 0, palette, p.u.uPalette);
    };

    return {
      draw({ time, dt, width, height, cssWidth, cssHeight, pointer }) {
        const aspect = width / height;
        const card = cardHalfSize(cssWidth, cssHeight);
        const o = live.current;
        gl.viewport(0, 0, width, height);
        gl.disable(gl.BLEND);
        common(bg, time, aspect, card);
        drawFullscreen(gl);

        // The assembled mark: as big as fits, a little taller than the card.
        const markSize = Math.min(0.66, aspect * 0.98);
        const target = o.interactive && pointer.inside ? 1 : 0;
        push += (target - push) * Math.min(1, dt * 4);
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
        common(shards, time, aspect, card);
        bindTexture(gl, 1, mark, shards.u.uMark);
        gl.uniform1f(shards.u.uCycle!, Math.max(4, o.cycle));
        gl.uniform1f(shards.u.uMarkSize!, markSize);
        gl.uniform1f(shards.u.uMarkAlpha!, Math.max(0, Math.min(1, o.markOpacity)));
        gl.uniform3f(shards.u.uPointer!, (pointer.x - 0.5) * aspect, pointer.y - 0.5, push);
        gl.bindVertexArray(vao);
        gl.drawArrays(gl.TRIANGLES, 0, mesh.count * 3);
        gl.bindVertexArray(null);
        gl.disable(gl.BLEND);
      },
      dispose() {
        gl.deleteProgram(bg.program);
        gl.deleteProgram(shards.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
        gl.deleteVertexArray(vao);
        for (const b of buffers) gl.deleteBuffer(b);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
