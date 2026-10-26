"use client";
import { ShaderStage, type ShaderStageProps } from "ascii/shader";
import LuminoHoloScene, { type LuminoHoloSceneProps } from "./scene.js";

export type LuminoHoloProps = ShaderStageProps & LuminoHoloSceneProps;

const clip = () => import("./clip.js");

/** The Lumino brandmark as shimmering holographic foil, in ASCII. Without WebGPU it plays a baked clip of the same scene. */
export function LuminoHolo({ bg = "#04060c", hueShift, sparkle, aberration, look = "dots", fit = "contain", ...props }: LuminoHoloProps) {
  return (
    <ShaderStage
      scene={<LuminoHoloScene bg={bg} hueShift={hueShift} sparkle={sparkle} aberration={aberration} />}
      clip={clip} bg={bg} look={look} fit={fit} {...props}
    />
  );
}
