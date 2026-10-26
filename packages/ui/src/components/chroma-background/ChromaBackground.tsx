"use client";
import type { ComponentProps } from "react";
import { ChromaFlow, MeshGradient } from "shaders/react";
import { AsciiOverlay, splitStage, type StageOptions } from "../ascii-overlay/AsciiOverlay.js";

/** Every prop of shaders/react's <ChromaFlow> (colours, intensity, radius, ...), plus the stage's (ascii, dim, children, ...) and the resting mesh's two colours. */
export type ChromaBackgroundProps = StageOptions & Omit<ComponentProps<typeof ChromaFlow>, keyof StageOptions> & {
  /** The dark mesh gradient that drifts under the flow, so there is something before the pointer moves. Default #0b0b1a to #2a1a5e. */
  restA?: string;
  restB?: string;
};

/** The look out of the box; any prop you pass wins. baseColor is black so the flow screens over the mesh. */
export const CHROMA_DEFAULTS = { baseColor: "#000000", upColor: "#38bdf8", downColor: "#ff2bd6", leftColor: "#7c3aed", rightColor: "#ffd98e", intensity: 2, radius: 3, momentum: 30 } as const;

/** Liquid colour that follows the pointer, tinted by the direction it moves, over a slow dark mesh. Fills its container behind your content; ascii="overlay" or "full" adds GPU ASCII. */
export function ChromaBackground(props: ChromaBackgroundProps) {
  const [stage, { restA = "#0b0b1a", restB = "#2a1a5e", ...own }] = splitStage(props);
  const p = { ...CHROMA_DEFAULTS, ...own };
  return (
    <AsciiOverlay
      ascii="off" {...stage}
      layers={<><MeshGradient stops={null} colorA={restA} colorB={restB} speed={0.5} /><ChromaFlow {...p} blendMode="screen" /></>}
      fallback={`linear-gradient(160deg, ${restA}, ${restB})`}
    />
  );
}
