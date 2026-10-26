"use client";
// Placeholder while LuminoShards is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type LuminoShardsProps = LuminoBackgroundProps;

export function LuminoShards({ paused, speed, quality, dpr, ...frame }: LuminoShardsProps) {
  void paused; void speed; void quality; void dpr;
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
