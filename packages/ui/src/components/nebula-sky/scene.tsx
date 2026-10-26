/* nebula-sky's scene: billowing gas, god rays from one corner and drifting motes. Baked as-is by scripts/bake.mjs. */
import { Shader, SolidColor, Nebula, Godrays, FloatingParticles } from "shaders/react";

export interface NebulaSkySceneProps {
  /** The backdrop. Default #04060c. */
  bg?: string;
  /** The glowing gas. Default #b04cff. */
  gas?: string;
  /** The cool veil around it. Default #3a5bdb. */
  veil?: string;
  /** The hot cores. Default #ffc9a0. */
  core?: string;
  /** The god rays. Default #5a7bff. */
  rays?: string;
}

export default function NebulaSkyScene({ bg = "#04060c", gas = "#b04cff", veil = "#3a5bdb", core = "#ffc9a0", rays = "#5a7bff" }: NebulaSkySceneProps) {
  return (
    <Shader>
      <SolidColor color={bg} />
      {/* A rectangle bigger than the canvas, so the gas fills it rather than a glass sphere. */}
      <Nebula shape={{ type: "roundedRectSDF", radius: 1.2, height: 1.2 }} gasColor={gas} veilColor={veil} coreColor={core}
        density={0.9} cavity={0.35} dust={0.5} glow={0.35} billow={0.8} stars={0.12} />
      <Godrays center={{ x: 0.85, y: 0.15 }} rayColor={rays} density={0.2} intensity={0.35} speed={0.3} blendMode="screen" />
      <FloatingParticles count={500} particleSize={1.4} speed={0.15} twinkle={0.8} />
    </Shader>
  );
}
