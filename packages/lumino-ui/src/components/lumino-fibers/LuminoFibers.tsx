"use client";
/*
 * LuminoFibers: React Bits' GhostFibers in the brand gradient, drawn over in ASCII
 * glyphs by its glyph pass, with the brandmark as one of the glyphs, as in
 * LuminoGlyphs: a share of the lit cells show the mark instead of a character.
 */
import { useEffect, useState, type CSSProperties } from "react";
import { GhostFibers, type AsciiGlyphMark, type GhostFibersAscii, type GhostFibersProps } from "ascii/ghost-fibers";
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { BRANDMARK, LUMINO_COLORS as C } from "../../brand/brand.js";

export interface LuminoFibersProps extends LuminoBackgroundProps {
  /** Glyphs over the fibers (overlay), fibers only as glyphs (full), or plain fibers (off). Default overlay. */
  ascii?: GhostFibersAscii;
  /** Glyph cell height in CSS pixels. Default 16. */
  cellSize?: number;
  /** Glyph opacity, 0 to 1. Default 0.8. */
  asciiOpacity?: number;
  /** The glyph ramp, darkest to brightest. Default " .:-=+*#%@". */
  characters?: string;
  /** Share of lit cells drawn as the brandmark, 0 to 1. Default 0.2. */
  markChance?: number;
  /** Any other GhostFibers prop, over this background's defaults. */
  fibers?: Partial<GhostFibersProps>;
}

/** The brandmark as a glyph. Its geometry fills ~60% of its viewBox, so 1.8 sizes it a touch over a character. */
export const FIBERS_MARK: AsciiGlyphMark = { viewBox: BRANDMARK.viewBox, paths: BRANDMARK.paths, scale: 1.8 };

/** The ground with soft brand glows along the ribbons' path: the backdrop, and the look without WebGL. */
const FALLBACK = [
  `radial-gradient(40% 40% at 70% 30%, ${C.indigo}55, transparent 70%)`,
  `radial-gradient(35% 35% at 25% 75%, ${C.wine}44, transparent 70%)`,
  C.ground,
].join(", ");

const FILL: CSSProperties = { position: "absolute", inset: 0 };

/** GhostFibers drawn in glyphs and brandmarks. */
export function LuminoFibers({
  ascii = "overlay", cellSize = 16, asciiOpacity = 0.8, characters, markChance = 0.2, fibers, paused, speed = 1, quality: _quality, dpr, ...frame
}: LuminoFibersProps) {
  // GhostFibers reports no first frame; fade the art in once it has mounted.
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const art = (
    <GhostFibers
      glowColor={C.coral}
      secondaryColor={C.blue}
      lineColor={C.peach}
      gradient="along"
      rotation={14}
      vignette={0.45}
      brightness={1.6}
      glow={1.1}
      {...fibers}
      ascii={ascii}
      cellSize={cellSize}
      asciiOpacity={asciiOpacity}
      {...(characters !== undefined ? { characters } : {})}
      marks={[{ ...FIBERS_MARK, chance: Math.min(1, Math.max(0, markChance)) }]}
      paused={paused}
      speed={(fibers?.speed ?? 0.5) * speed}
      dpr={dpr ?? fibers?.dpr}
      style={FILL}
    />
  );
  return <BackgroundFrame fallback={FALLBACK} {...frame} ready={ready} art={art} />;
}
