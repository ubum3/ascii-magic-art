"use client";
// HalftoneTide: placeholder until it is built.
import { BackgroundFrame, type LuminoBackgroundProps } from "../../backgrounds/frame.js";

export type HalftoneTideProps = LuminoBackgroundProps;

export function HalftoneTide({ paused: _p, speed: _s, quality: _q, dpr: _d, ...frame }: HalftoneTideProps) {
  return <BackgroundFrame {...frame} ready={false} art={null} />;
}
