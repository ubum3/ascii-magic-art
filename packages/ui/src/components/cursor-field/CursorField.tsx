"use client";
import { ShaderStage, type ClipLoader, type ShaderStageProps } from "../../shader/ShaderStage.js";
import CursorFieldScene, { type CursorFieldSceneProps, type CursorFieldVariant } from "./scene.js";

export type CursorFieldProps = ShaderStageProps & CursorFieldSceneProps;

const clips: Record<CursorFieldVariant, ClipLoader> = {
  flow: () => import("./clip-flow.js"),
  filings: () => import("./clip-filings.js"),
  bloom: () => import("./clip-bloom.js"),
  smoke: () => import("./clip-flow.js"), // smoke is empty without a cursor
};

/** A pointer-stirred simulation as halftone ASCII, filling its container behind your content. Without WebGPU it plays a baked clip (with no cursor). */
export function CursorField({ variant = "flow", bg = "#05060a", colorA, colorB, look = "dots", ...props }: CursorFieldProps) {
  return (
    <ShaderStage
      // A new variant is a new simulation: start it fresh.
      key={variant}
      scene={<CursorFieldScene variant={variant} bg={bg} colorA={colorA} colorB={colorB} />}
      clip={clips[variant]} bg={bg} look={look} {...props}
    />
  );
}
