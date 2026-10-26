"use client";
import { useEffect, useState } from "react";
import { Shader, Aurora, FilmGrain, Plasma, Swirl } from "shaders/react";
import { AsciiShader } from "ascii-magic-art-react/shader";
import { AsciiArt } from "ascii-magic-art-react";

export function AuroraShader() {
  return (
    <AsciiShader cols={96} colors={24} fallback={<AsciiArt piece="aurora-curtains" />}>
      <Shader><Aurora colorA="#1fd1a5" colorB="#7ee787" colorC="#8a5cff" /><FilmGrain /></Shader>
    </AsciiShader>
  );
}

export function PlasmaShader() {
  return (
    <AsciiShader cols={96} square={false} colors={16} look="ascii">
      <Shader><Plasma /></Shader>
    </AsciiShader>
  );
}

export function SwirlShader() {
  return (
    <AsciiShader cols={96} colors={32} interactive>
      <Shader><Swirl /></Shader>
    </AsciiShader>
  );
}

/** Stands in for a <Shader> on a machine without WebGPU: it reports itself unavailable. */
function NoGpu({ onUnavailable }: { onUnavailable?: (reason: string) => void }) {
  useEffect(() => { onUnavailable?.("simulated"); }, [onUnavailable]);
  return null;
}

export function Fallback() {
  const [reason, setReason] = useState<string>();
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <AsciiShader cols={96} fallback={<AsciiArt piece="aurora-curtains" />} onUnavailable={(r) => setReason(String(r))}>
        <NoGpu />
      </AsciiShader>
      <span style={{ color: "var(--muted)" }}>onUnavailable: {reason ?? "not yet"}</span>
    </div>
  );
}
