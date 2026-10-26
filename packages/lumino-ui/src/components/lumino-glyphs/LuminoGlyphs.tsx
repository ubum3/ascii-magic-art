"use client";
/*
 * LuminoGlyphs: the portal sign-in page's GradientASCII as a Lumino background. A
 * horizon of glyphs in purple, plum and rose on black, the brandmark the most
 * common glyph, and amounts typed over it. The defaults are the settings tuned in
 * lumino-services (portal/v2 auth-background.tsx); every GradientASCII prop
 * overrides them.
 */
import { useCallback, useState, type CSSProperties } from "react";
import { BRANDMARK } from "../../brand/brand.js";
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { GradientASCII, type AsciiMark, type GradientASCIIOptions } from "./GradientAscii.js";

export interface LuminoGlyphsProps extends LuminoBackgroundProps, Omit<GradientASCIIOptions, "paused" | "speed" | "dpr" | "onReady"> {}

const COLORS = ["#5c539f", "#332c69", "#783d65", "#aa5361"] as const;
// The mark's geometry fills ~60% of its viewBox; 1.8 sizes it a touch over a digit.
// `chance` gives it 30% of lit cells outright, so it is the most common glyph.
const MARKS: readonly AsciiMark[] = [{ key: "◆", ...BRANDMARK, scale: 1.8, chance: 0.3 }];
const WORDS = ["48", "212", "$"] as const;
const WORD_BAND = [0, 1] as const;

/** The look before the first frame and without WebGL2: the four colours as a horizon glow on black. */
export const GLYPHS_FALLBACK = [
  // The dark planet low in the middle, the rose sky in the top corners, purple between.
  "radial-gradient(90% 58% at 50% 100%, #000 52%, transparent 100%)",
  `radial-gradient(50% 55% at 0% 0%, ${COLORS[3]}d0, transparent 80%)`,
  `radial-gradient(50% 55% at 100% 0%, ${COLORS[3]}d0, transparent 80%)`,
  `radial-gradient(75% 40% at 50% 48%, ${COLORS[0]}90, transparent 80%)`,
  `linear-gradient(to bottom, ${COLORS[1]}, ${COLORS[0]} 42%, ${COLORS[1]} 62%, #000 82%)`,
].join(", ");

// GradientASCII sits on black, as on the portal (its canvas is transparent where the field is dark).
const ART: CSSProperties = { position: "absolute", inset: 0, background: "#000" };

/** The portal's glyph horizon as a Lumino background. */
export function LuminoGlyphs({
  paused,
  speed = 1,
  quality: _quality,
  dpr = 1.5,
  dim,
  children,
  colors = COLORS,
  shape = "horizon",
  characters = " 014◆827@#+=",
  marks = MARKS,
  words = WORDS,
  wordRate = 1.5,
  wordLife = 2.5,
  wordBand = WORD_BAND,
  wordColor = "#a3a3a3",
  wordOpacity = 0.75,
  cellSize = 18,
  density = 0.8,
  glyphOpacity = 0.85,
  glow = 0.8,
  depthOfField,
  flicker = 0.2,
  softness = 0.8,
  scale = 1.3,
  flow = 0.5,
  gradientOpacity = 1,
  grain = 0.2,
  variation,
  mouseInteraction = false,
  scrambleRadius = 0.1,
  clickEffect = "wave",
  intro = true,
  lightMode = false,
  fontFamily,
  ...frame
}: LuminoGlyphsProps) {
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const art = (
    <GradientASCII
      style={ART}
      onReady={onReady}
      paused={paused}
      speed={speed}
      dpr={dpr}
      {...{ colors, shape, characters, marks, words, wordRate, wordLife, wordBand, wordColor, wordOpacity, cellSize, density, glyphOpacity, glow }}
      {...{ depthOfField, flicker, softness, scale, flow, gradientOpacity, grain, variation, mouseInteraction, scrambleRadius, clickEffect, intro, lightMode, fontFamily }}
    />
  );
  return (
    <BackgroundFrame {...frame} dim={dim} fallback={GLYPHS_FALLBACK} ready={ready} art={art}>
      {children}
    </BackgroundFrame>
  );
}
