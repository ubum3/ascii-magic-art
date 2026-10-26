"use client";
// The older ASCII backgrounds (EdgeOrbit, LuminoSpace) as Lumino backgrounds: inside BackgroundFrame, with its props.
import { EdgeOrbit } from "../components/edge-orbit/index.js";
import { LuminoSpace } from "../components/lumino-space/index.js";
import { BackgroundFrame, type LuminoBackgroundProps } from "./frame.js";

const FILL = { position: "absolute", inset: 0, height: "100%" } as const;

/** EdgeOrbit (the night Earth from orbit, with a brandmark star) as a Lumino background. */
export function EdgeOrbitBackground({ paused, speed, quality: _q, dpr: _d, ...frame }: LuminoBackgroundProps) {
  return <BackgroundFrame {...frame} ready art={<EdgeOrbit paused={paused} speed={speed} style={FILL} />} />;
}

/** LuminoSpace (deep space with brandmark stars) as a Lumino background. */
export function LuminoSpaceBackground({ paused, speed, quality: _q, dpr: _d, ...frame }: LuminoBackgroundProps) {
  return <BackgroundFrame {...frame} ready art={<LuminoSpace paused={paused} speed={speed} style={FILL} />} />;
}
