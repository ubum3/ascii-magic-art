"use client";
// Placeholder while LuminoOrb is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type LuminoOrbProps = LuminoBackgroundProps;

export function LuminoOrb({ paused, speed, quality, dpr, ...frame }: LuminoOrbProps) {
  void paused; void speed; void quality; void dpr;
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
