"use client";
// LuminoGlyphs: placeholder until it is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type LuminoGlyphsProps = LuminoBackgroundProps;

export function LuminoGlyphs({ paused: _p, speed: _s, quality: _q, dpr: _d, ...frame }: LuminoGlyphsProps) {
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
