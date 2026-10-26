"use client";
import { useState } from "react";
import { DarkVeil } from "ascii/dark-veil";
import { Threads } from "ascii/threads";
import { PixelSnow, type PixelSnowVariant } from "ascii/pixel-snow";
import { GhostFibers, type GhostFibersHover, type GhostFibersStyle } from "ascii/ghost-fibers";

const box = { position: "relative", height: "60vh", borderRadius: 12, overflow: "hidden", marginBottom: "2rem", background: "#000" } as const;
const center = { position: "absolute", inset: 0, display: "grid", placeItems: "center", color: "#fff", pointerEvents: "none" } as const;

export default function ReactBitsPage() {
  const [color, setColor] = useState("#6b12ff");
  const [sheen, setSheen] = useState(1);
  const [warp, setWarp] = useState(0);
  const [variation, setVariation] = useState(0);
  const [fiberStyle, setFiberStyle] = useState<GhostFibersStyle>("dots");
  const [hover, setHover] = useState<GhostFibersHover>("focus");
  const [tips, setTips] = useState(0);
  const [parting, setParting] = useState(0.5);
  const [flake, setFlake] = useState<PixelSnowVariant>("snowflake");
  const [wind, setWind] = useState(0.25);
  return (
    <div>
      <h2>DarkVeil (move your cursor)</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        <label>color <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
        <label>sheen <input type="range" min={0} max={2} step={0.1} value={sheen} onChange={(e) => setSheen(+e.target.value)} /></label>
        <label>warp <input type="range" min={0} max={2} step={0.1} value={warp} onChange={(e) => setWarp(+e.target.value)} /></label>
        <button onClick={() => setVariation((v) => v + 1)}>new shape ({variation})</button>
      </div>
      <div style={box}>
        <DarkVeil color={color} sheen={sheen} warp={warp} variation={variation} />
        <div style={center}><h1 style={{ fontSize: "3rem", margin: 0 }}>Dark Veil</h1></div>
      </div>

      <h2>DarkVeil with lightMode and faded edges</h2>
      <div style={{ ...box, background: "#f4f1ea" }}>
        <DarkVeil lightMode fade={0.6} color="#0f766e" />
      </div>

      <h2>GhostFibers (hover to focus, click a ribbon to pulse it)</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        {(["dots", "dashes", "lines"] as const).map((f) => <button key={f} onClick={() => setFiberStyle(f)} aria-pressed={f === fiberStyle}>{f}</button>)}
        <span style={{ color: "var(--muted)" }}>hover:</span>
        {(["focus", "part", "none"] as const).map((e) => <button key={e} onClick={() => setHover(e)} aria-pressed={e === hover}>{e}</button>)}
        <label>tips <input type="range" min={0} max={1} step={0.1} value={tips} onChange={(e) => setTips(+e.target.value)} /></label>
      </div>
      <div style={box}>
        <GhostFibers fiberStyle={fiberStyle} hoverEffect={hover} tips={tips} />
      </div>

      <h2>GhostFibers in your colours, along-the-ribbon gradient</h2>
      <div style={box}>
        <GhostFibers glowColor="#38bdf8" secondaryColor="#ff2bd6" gradient="along" layers={2} twist={0.6} threads={110} />
      </div>

      <h2>GhostFibers with lightMode</h2>
      <div style={{ ...box, background: "#f4f1ea" }}>
        <GhostFibers lightMode glowColor="#7c3aed" fiberStyle="lines" />
      </div>

      <h2>Threads (move your cursor: it steers the waves and parts the threads)</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginBottom: "1rem" }}>
        <label>parting <input type="range" min={0} max={1} step={0.1} value={parting} onChange={(e) => setParting(+e.target.value)} /></label>
      </div>
      <div style={box}>
        <Threads enableMouseInteraction parting={parting} />
      </div>

      <h2>Threads in two colours, lower waves tilted the other way, faded edges</h2>
      <div style={box}>
        <Threads color="#38bdf8" accentColor="#ff2bd6" lineCount={140} amplitude={1} angle={-15} fade={0.4} seed={3} />
      </div>

      <h2>PixelSnow (move your cursor through it; it piles up along the bottom)</h2>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginBottom: "1rem" }}>
        {(["snowflake", "square", "round"] as const).map((v) => <button key={v} onClick={() => setFlake(v)} aria-pressed={v === flake}>{v}</button>)}
        <label>wind <input type="range" min={-2} max={2} step={0.25} value={wind} onChange={(e) => setWind(+e.target.value)} /></label>
      </div>
      <div style={{ ...box, background: "#060a14" }}>
        <PixelSnow variant={flake} wind={wind} accumulate />
        <div style={center}><h1 style={{ fontSize: "3rem", margin: 0 }}>Let it snow</h1></div>
      </div>

      <h2>PixelSnow with lightMode: blue round pixels, bigger, rising</h2>
      <div style={{ ...box, background: "#f4f1ea" }}>
        <PixelSnow lightMode color="#2563eb" variant="round" pixelSize={5} speed={-0.6} density={0.3} fade={0.3} />
      </div>
    </div>
  );
}
