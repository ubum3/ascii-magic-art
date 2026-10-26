"use client";
// SignalRain: placeholder until it is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type SignalRainProps = LuminoBackgroundProps;

export function SignalRain({ paused: _p, speed: _s, quality: _q, dpr: _d, ...frame }: SignalRainProps) {
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
