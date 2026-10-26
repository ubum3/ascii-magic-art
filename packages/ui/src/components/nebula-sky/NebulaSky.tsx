"use client";
import { ShaderStage, type ShaderStageProps } from "../../shader/ShaderStage.js";
import NebulaSkyScene, { type NebulaSkySceneProps } from "./scene.js";

export type NebulaSkyProps = ShaderStageProps & NebulaSkySceneProps;

const clip = () => import("./clip.js");

/** A WebGPU nebula as halftone ASCII, filling its container behind your content. Without WebGPU it plays a baked clip of the same scene. */
export function NebulaSky({ bg = "#04060c", gas, veil, core, rays, look = "dots", ...props }: NebulaSkyProps) {
  return <ShaderStage scene={<NebulaSkyScene bg={bg} gas={gas} veil={veil} core={core} rays={rays} />} clip={clip} bg={bg} look={look} {...props} />;
}
