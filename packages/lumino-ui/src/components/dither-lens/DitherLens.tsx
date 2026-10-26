"use client";
// DitherLens: placeholder until it is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type DitherLensProps = LuminoBackgroundProps;

export function DitherLens({ paused: _p, speed: _s, quality: _q, dpr: _d, ...frame }: DitherLensProps) {
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
