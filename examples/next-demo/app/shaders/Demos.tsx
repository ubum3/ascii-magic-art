"use client";
import { useState } from "react";
import { CursorField, CURSOR_FIELD_VARIANTS, type CursorFieldVariant } from "ascii/cursor-field";
import { NebulaSky } from "ascii/nebula-sky";
import { LuminoHolo } from "ascii/lumino-holo";
import { AsciiTransition, ASCII_TRANSITION_EFFECTS, type AsciiTransitionEffect } from "ascii/ascii-transition";

const box = { height: "60vh", borderRadius: 12 };
const center = { display: "grid", placeItems: "center", height: "100%", color: "#fff", textAlign: "center" } as const;

function Pick<T extends string>({ options, value, onChange }: { options: readonly T[]; value: T; onChange: (v: T) => void }) {
  return (
    <div style={{ display: "flex", gap: "0.5rem", margin: "0.5rem 0" }}>
      {options.map((o) => <button key={o} onClick={() => onChange(o)} aria-pressed={o === value}>{o}</button>)}
    </div>
  );
}

export function Demos() {
  const [baked, setBaked] = useState(false);
  const [variant, setVariant] = useState<CursorFieldVariant>("flow");
  const [effect, setEffect] = useState<AsciiTransitionEffect>("iris");
  const [slide, setSlide] = useState(0);
  return (
    <div style={{ display: "grid", gap: "2.5rem" }}>
      <label style={{ color: "var(--muted)" }}>
        <input type="checkbox" checked={baked} onChange={(e) => setBaked(e.target.checked)} /> Play the baked clips, as a browser without WebGPU would
      </label>

      <section>
        <h2>CursorField</h2>
        <Pick options={CURSOR_FIELD_VARIANTS} value={variant} onChange={setVariant} />
        <CursorField variant={variant} baked={baked} style={box}>
          <div style={center}><h1 style={{ fontSize: "3rem", margin: 0, pointerEvents: "none" }}>Move your cursor</h1></div>
        </CursorField>
      </section>

      <section>
        <h2>NebulaSky</h2>
        <NebulaSky baked={baked} dim={0.1} style={box}>
          <div style={center}><h1 style={{ fontSize: "3rem", margin: 0 }}>Lumino</h1></div>
        </NebulaSky>
      </section>

      <section>
        <h2>LuminoHolo</h2>
        <LuminoHolo baked={baked} style={box} />
      </section>

      <section>
        <h2>AsciiTransition</h2>
        <Pick options={ASCII_TRANSITION_EFFECTS} value={effect} onChange={setEffect} />
        <button onClick={() => setSlide((s) => s + 1)}>Next slide</button>
        <AsciiTransition show={slide} effect={effect} style={{ ...box, height: "40vh", marginTop: "0.5rem", overflow: "hidden" }}>
          <div style={{ ...center, background: ["#0f172a", "#1e1b4b", "#052e16"][slide % 3] }}>
            <h1 style={{ fontSize: "4rem", margin: 0 }}>Slide {slide + 1}</h1>
          </div>
        </AsciiTransition>
      </section>
    </div>
  );
}
