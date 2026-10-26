"use client";
import { useState } from "react";
import { ImageTexture } from "shaders/react";
import { AsciiOverlay, type AsciiMode } from "ascii/ascii-overlay";
import { PlasmaBackground } from "ascii/plasma-background";
import { SilkBackground } from "ascii/silk-background";
import { MeshBackground } from "ascii/mesh-background";
import { ChromaBackground } from "ascii/chroma-background";

const box = { height: "50vh", borderRadius: 12, marginBottom: "2rem" };
const center = { display: "grid", placeItems: "center", height: "100%", color: "#fff", textAlign: "center" } as const;
const MODES: AsciiMode[] = ["off", "overlay", "full"];

export default function GradientsPage() {
  const [ascii, setAscii] = useState<AsciiMode>("overlay");
  const title = (t: string) => <div style={center}><h1 style={{ fontSize: "3rem", margin: 0 }}>{t}</h1></div>;
  return (
    <div>
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem" }}>
        <span style={{ color: "var(--muted)" }}>ascii:</span>
        {MODES.map((m) => <button key={m} onClick={() => setAscii(m)} aria-pressed={m === ascii}>{m}</button>)}
      </div>

      <h2>PlasmaBackground</h2>
      <PlasmaBackground ascii={ascii} style={box}>{title("Plasma")}</PlasmaBackground>

      <h2>SilkBackground</h2>
      <SilkBackground ascii={ascii} style={box}>{title("Silk")}</SilkBackground>

      <h2>MeshBackground</h2>
      <MeshBackground ascii={ascii} style={box}>{title("Mesh")}</MeshBackground>

      <h2>ChromaBackground (move your cursor)</h2>
      <ChromaBackground ascii={ascii} style={box}>{title("Chroma")}</ChromaBackground>

      <h2>Customised: your colours, slower, bigger glyphs</h2>
      <PlasmaBackground ascii={ascii} colorA="#00ffa3" colorB="#001a33" speed={0.5} warp={1} cellSize={24} characters="#*+-. " style={box} />

      <h2>Customised: a mesh in your palette</h2>
      <MeshBackground ascii={ascii} colors={["#001219", "#005f73", "#0a9396", "#94d2bd", "#e9d8a6"]} swirl={0.6} style={box} />

      <h2>AsciiOverlay over a picture</h2>
      <AsciiOverlay ascii={ascii === "off" ? "overlay" : ascii} layers={<ImageTexture />} style={box} />
    </div>
  );
}
