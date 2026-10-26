/* cursor-field's scenes: simulations the pointer stirs. Each variant is baked by scripts/bake.mjs (smoke needs a cursor, so it falls back to flow). */
import { Shader, SolidColor, ParticleFlow, MagneticFilings, ReactionDiffusion, SmokeFlow } from "shaders/react";

export type CursorFieldVariant = "flow" | "filings" | "bloom" | "smoke";
export const CURSOR_FIELD_VARIANTS: readonly CursorFieldVariant[] = ["flow", "filings", "bloom", "smoke"];

export interface CursorFieldSceneProps {
  /** flow: dust the pointer plows through. filings: iron filings around a magnet. bloom: reaction-diffusion that grows where you drag. smoke: smoke from the pointer. Default flow. */
  variant?: CursorFieldVariant;
  /** The backdrop. Default #05060a. */
  bg?: string;
  /** The two colours the variant blends between. Defaults suit each variant. */
  colorA?: string;
  colorB?: string;
}

const COLORS: Record<CursorFieldVariant, [string, string]> = {
  flow: ["#8ec5ff", "#ffd98e"],
  filings: ["#be1ef9", "#38bdf8"],
  bloom: ["#e2f5ff", "#38bdf8"],
  smoke: ["#e29c8b", "#d517f9"],
};

export default function CursorFieldScene({ variant = "flow", bg = "#05060a", colorA, colorB }: CursorFieldSceneProps) {
  const [a, b] = [colorA ?? COLORS[variant][0], colorB ?? COLORS[variant][1]];
  // Particles and filings are drawn big: the art samples one pixel block per cell.
  const layer = {
    flow: <ParticleFlow colorA={a} colorB={b} count={3000} size={4} trails={0.6} ambient={0.4} />,
    filings: <MagneticFilings colorA={a} colorB={b} count={2500} size={3} />,
    bloom: <ReactionDiffusion colorA={bg} colorB={a} colorC={b} featureSize={8} speed={12} />,
    smoke: <SmokeFlow colorA={a} colorB={b} intensity={1.5} />,
  }[variant];
  return <Shader><SolidColor color={bg} />{layer}</Shader>;
}
