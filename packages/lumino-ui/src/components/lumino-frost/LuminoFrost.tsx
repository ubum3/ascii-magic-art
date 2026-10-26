"use client";
// Placeholder while LuminoFrost is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type LuminoFrostProps = LuminoBackgroundProps;

export function LuminoFrost({ paused, speed, quality, dpr, ...frame }: LuminoFrostProps) {
  void paused; void speed; void quality; void dpr;
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
