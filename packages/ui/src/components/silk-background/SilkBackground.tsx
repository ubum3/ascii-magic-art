"use client";
import type { ComponentProps } from "react";
import { FlowingGradient } from "shaders/react";
import { AsciiOverlay, splitStage, type StageOptions } from "../ascii-overlay/AsciiOverlay.js";

/** Every prop of shaders/react's <FlowingGradient> (colours, speed, blend, ...), plus the stage's: ascii, dim, children and the rest. */
export type SilkBackgroundProps = StageOptions & Omit<ComponentProps<typeof FlowingGradient>, keyof StageOptions>;

/** The look out of the box; any prop you pass wins. */
export const SILK_DEFAULTS = { colorA: "#0a0015", colorB: "#6b17e6", colorC: "#ff4d6a", colorD: "#ff6b35" } as const;

const c = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Liquid silk: four colours in slow organic flowing bands. Fills its container behind your content; ascii="overlay" or "full" adds GPU ASCII. */
export function SilkBackground(props: SilkBackgroundProps) {
  const [stage, own] = splitStage(props);
  const p = { ...SILK_DEFAULTS, ...own };
  return <AsciiOverlay ascii="off" {...stage} layers={<FlowingGradient {...p} />} fallback={`linear-gradient(135deg, ${[p.colorA, p.colorB, p.colorC, p.colorD].map(c).filter(Boolean).join(", ")})`} />;
}
