"use client";
import type { ComponentProps } from "react";
import { Plasma } from "shaders/react";
import { AsciiOverlay, splitStage, type StageOptions } from "../ascii-overlay/AsciiOverlay.js";

/** Every prop of shaders/react's <Plasma> (colours, speed, blend, ...), plus the stage's: ascii, dim, children and the rest. */
export type PlasmaBackgroundProps = StageOptions & Omit<ComponentProps<typeof Plasma>, keyof StageOptions>;

/** The look out of the box; any prop you pass wins. */
export const PLASMA_DEFAULTS = { colorA: "#ff2bd6", colorB: "#0a0420", density: 2, speed: 1.2, intensity: 1.6, warp: 0.6 } as const;

const c = (v: unknown) => (typeof v === "string" ? v : undefined);

/** Glowing plasma: warped bands of colour that pulse and fold. Fills its container behind your content; ascii="overlay" or "full" adds GPU ASCII (gamma 0.25: plasma is mostly dark). */
export function PlasmaBackground(props: PlasmaBackgroundProps) {
  const [stage, own] = splitStage(props);
  const p = { ...PLASMA_DEFAULTS, ...own };
  return <AsciiOverlay ascii="off" gamma={0.25} {...stage} layers={<Plasma {...p} />} fallback={`radial-gradient(circle at 30% 40%, ${c(p.colorA) ?? "#ff2bd6"}, ${c(p.colorB) ?? "#0a0420"} 70%)`} />;
}
