"use client";
/*
 * SignalRain: dim falling columns of monospace glyphs, cool and quiet, that ignite into
 * warm light as they pass through a large, otherwise invisible brandmark, so the rain
 * draws the mark. One WebGL2 pass: a fragment shader picks each cell's glyph, fall and
 * brightness from hashes of the cell and time (no per-frame CPU work), draws it from a
 * canvas-rendered glyph atlas, and samples the mark's SDF to decide ignition.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, canvasTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture } from "../../backgrounds/gl.js";
import { LUMINO_COLORS } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { RAIN } from "./glsl.js";

export interface SignalRainProps extends LuminoBackgroundProps {
  /** Share of cells holding a glyph, 0 to 1. Default 0.5. */
  density?: number;
  /** The common glyphs, picked at random per cell. Default "0123456789$.". */
  glyphs?: string;
  /** A rare glyph (about 3% of cells), or "" for none. Default "◆". */
  accent?: string;
  /** Cell size of the middle layer, in CSS pixels (the far layer is smaller, the near one larger). Default 18. */
  cellSize?: number;
  /** Strength of the soft bloom around glyphs, 0 to 2. Default 1. */
  glow?: number;
}

/** Pixels per atlas slot: big enough for crisp glyphs, with room around each for the bloom mips. */
const SLOT = 64;
const FONT = `500 ${Math.round(SLOT * 0.62)}px ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace`;

/** The glyphs drawn white into a row of slots (a power of two wide), and how many slots there are. */
function glyphAtlas(chars: string[]) {
  let slots = 1;
  while (slots < chars.length) slots *= 2;
  const canvas = document.createElement("canvas");
  canvas.width = slots * SLOT;
  canvas.height = SLOT;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.font = FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  chars.forEach((c, i) => {
    // The diamond is drawn smaller: at text size it outweighs the digits.
    if (c === "◆") {
      ctx.save();
      ctx.font = FONT.replace(/\d+px/, `${Math.round(SLOT * 0.38)}px`);
      ctx.fillText(c, (i + 0.5) * SLOT, SLOT * 0.52);
      ctx.restore();
    } else ctx.fillText(c, (i + 0.5) * SLOT, SLOT * 0.54);
  });
  return { canvas, slots };
}

/** The look before (or without) WebGL: cool haze on the ground, a warm glow where the mark sits, faint columns. */
const FALLBACK = [
  `radial-gradient(30% 40% at 88% 62%, ${LUMINO_COLORS.coral}30, transparent 70%)`,
  `radial-gradient(18% 24% at 86% 58%, ${LUMINO_COLORS.peach}22, transparent 70%)`,
  `radial-gradient(50% 55% at 10% 10%, ${LUMINO_COLORS.indigo}88, transparent 70%)`,
  `radial-gradient(40% 50% at 0% 70%, ${LUMINO_COLORS.blue}22, transparent 70%)`,
  `repeating-linear-gradient(90deg, ${LUMINO_COLORS.lavender}08 0 1px, transparent 1px 18px)`,
  LUMINO_COLORS.ground,
].join(", ");

/** Falling glyph rain that ignites into warm light inside a large brandmark. */
export function SignalRain({
  paused, speed, quality = 1, dpr,
  density = 0.5, glyphs = "0123456789$.", accent = "◆", cellSize = 18, glow = 1,
  ...frame
}: SignalRainProps) {
  // The scene is set up once; it reads these live each frame.
  const live = useRef({ density, glyphs, accent, cellSize, glow });
  live.current = { density, glyphs, accent, cellSize, glow };

  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    const sdf = brandmarkSDF(512);
    const prog = link(gl, RAIN(markSpreadDefine(sdf)));
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    let atlas: WebGLTexture | null = null, atlasKey = "", slots = 1, common = 1, hasAccent = 0;
    // Rebuilt only when the glyphs change.
    const ensureAtlas = (chars: string, extra: string) => {
      const key = chars + "\u0000" + extra;
      if (key === atlasKey) return;
      const list = [...(chars || "0")];
      const acc = [...extra][0];
      const built = glyphAtlas(acc ? [...list, acc] : list);
      if (atlas) gl.deleteTexture(atlas);
      atlas = canvasTexture(gl, built.canvas);
      atlasKey = key;
      slots = built.slots;
      common = list.length;
      hasAccent = acc ? 1 : 0;
    };
    // The pointer nudges the layers a little, eased so it glides.
    const par = { x: 0, y: 0 };

    return {
      draw({ time, dt, width, height, cssWidth, pointer, still }) {
        const o = live.current;
        ensureAtlas(o.glyphs, o.accent);
        const px = width / cssWidth;
        const tx = pointer.inside ? (0.5 - pointer.x) * 18 * px : 0, ty = pointer.inside ? (0.5 - pointer.y) * 10 * px : 0;
        const k = still ? 1 : 1 - Math.exp(-dt * 2.5);
        par.x += (tx - par.x) * k;
        par.y += (ty - par.y) * k;

        gl.viewport(0, 0, width, height);
        gl.useProgram(prog.program);
        gl.uniform2f(prog.u.uResolution!, width, height);
        gl.uniform1f(prog.u.uTime!, time);
        gl.uniform1f(prog.u.uCell!, Math.max(6, o.cellSize) * px);
        gl.uniform1f(prog.u.uDensity!, Math.max(0, Math.min(1, o.density)));
        gl.uniform1f(prog.u.uGlyphs!, common);
        gl.uniform1f(prog.u.uAccent!, hasAccent);
        gl.uniform1f(prog.u.uSlots!, slots);
        gl.uniform1f(prog.u.uGlow!, Math.max(0, Math.min(2, o.glow)));
        gl.uniform2f(prog.u.uParallax!, par.x, par.y);
        bindTexture(gl, 0, palette, prog.u.uPalette);
        bindTexture(gl, 1, mark, prog.u.uMark);
        bindTexture(gl, 2, atlas, prog.u.uAtlas);
        drawFullscreen(gl);
      },
      dispose() {
        gl.deleteProgram(prog.program);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
        if (atlas) gl.deleteTexture(atlas);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame {...frame} fallback={FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
