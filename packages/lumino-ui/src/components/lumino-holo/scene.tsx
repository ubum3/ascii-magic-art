/* lumino-holo's scene: the brandmark as holographic foil. The logo is a hidden image that masks the foil; it is a PNG made from lumino-donut's mask (scripts/bake.mjs writes logo.ts). */
import { Shader, SolidColor, ImageTexture, Holographic, ChromaticAberration, Glow } from "shaders/react";
import { LOGO_PNG } from "./logo.js";

export interface LuminoHoloSceneProps {
  /** The backdrop. Default #04060c. */
  bg?: string;
  /** Turn the foil's rainbow, in degrees. Default 0. */
  hueShift?: number;
  /** Glitter flakes, 0 to 1. Default 0.6. */
  sparkle?: number;
  /** Split the colour channels at the edges, 0 to 1. Default 0.3. */
  aberration?: number;
}

export default function LuminoHoloScene({ bg = "#04060c", hueShift = 0, sparkle = 0.6, aberration = 0.3 }: LuminoHoloSceneProps) {
  return (
    <Shader>
      <SolidColor color={bg} />
      <ImageTexture id="lumino-logo" url={LOGO_PNG} objectFit="contain" visible={false} />
      {/* A rectangle bigger than the canvas, so the foil covers the whole logo. */}
      <Holographic shape={{ type: "roundedRectSDF", radius: 1, height: 1 }} maskSource="lumino-logo" maskType="alpha" hueShift={hueShift} sparkle={sparkle} />
      <ChromaticAberration strength={aberration} />
      <Glow intensity={0.6} threshold={0.4} size={20} />
    </Shader>
  );
}
