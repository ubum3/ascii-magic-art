"use client";
import type { ComponentProps } from "react";
import { MeshGradient } from "shaders/react";
import { AsciiOverlay, splitStage, type StageOptions } from "../ascii-overlay/AsciiOverlay.js";

/** Every prop of shaders/react's <MeshGradient> (stops, swirl, drift, ...), plus the stage's (ascii, dim, children, ...) and `colors`. */
export type MeshBackgroundProps = StageOptions & Omit<ComponentProps<typeof MeshGradient>, keyof StageOptions> & {
  /** The palette, dark to light, spaced evenly. Shorthand for `stops`. Default indigo, violet, magenta, orange, gold. */
  colors?: readonly string[];
};

/** The look out of the box (MeshGradient's own palette); any prop you pass wins. */
export const MESH_COLORS = ["#1a0533", "#6d2fd1", "#e04b9e", "#ff8c42", "#ffdf8e"] as const;
export const MESH_DEFAULTS = { count: 5, swirl: 0.3, drift: 0.5 } as const;

/** A mesh gradient: soft swaths of colour drifting and swirling into each other. Fills its container behind your content; ascii="overlay" or "full" adds GPU ASCII. */
export function MeshBackground(props: MeshBackgroundProps) {
  const [stage, { colors, ...own }] = splitStage(props);
  // MeshGradient reads colorA/colorB only when stops is null, so two colours alone mean two-colour mode.
  const twoColour = !colors && !("stops" in own) && ("colorA" in own || "colorB" in own);
  const palette = colors ?? (twoColour ? [own.colorA, own.colorB].filter((c): c is string => typeof c === "string") : MESH_COLORS);
  const stops = colors ? colors.map((color: string, i: number) => ({ color, position: colors.length > 1 ? i / (colors.length - 1) : 0 })) : twoColour ? null : undefined;
  const p = { ...MESH_DEFAULTS, ...own, ...(stops !== undefined ? { stops } : {}) };
  return <AsciiOverlay ascii="off" {...stage} layers={<MeshGradient {...p} />} fallback={`linear-gradient(160deg, ${palette.join(", ")})`} />;
}
