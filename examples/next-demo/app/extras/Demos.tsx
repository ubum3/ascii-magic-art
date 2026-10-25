"use client";
import { useEffect, useState } from "react";
import { AsciiSpec, AsciiSequence, AsciiClip, AsciiWebcam, BRAND_EFFECTS, type BrandSpec } from "ascii-magic-art-react/extras";
import markJson from "./mark.json";

// A spec from `ama-studio brand mark.svg --effect assemble -o mark.json`.
const mark = markJson as BrandSpec;

export function Brand() {
  const [effect, setEffect] = useState(0);
  const spec = { ...mark, effect: BRAND_EFFECTS[effect % BRAND_EFFECTS.length] };
  return (
    <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      <AsciiSpec spec={spec} size={9} />
      <button className="button" onClick={() => setEffect((e) => e + 1)}>Effect: {spec.effect} (next)</button>
    </div>
  );
}

/** Numbers that move, like a live feed. */
function useFeed() {
  const [t, setT] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setT((x) => x + 0.25), 250);
    return () => clearInterval(id);
  }, []);
  const values = Array.from({ length: Math.floor(t * 4) }, (_, i) => Math.round(60 + Math.sin(i * 0.17) * 25 + Math.sin(i * 0.6) * 8));
  return { t, values };
}

export function Dashboard() {
  const { t, values } = useFeed();
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      <AsciiSpec spec={{ kind: "progress", cols: 40 }} state={{ value: (t / 12) % 1, label: `Settling batch ${1 + Math.floor(t / 12)}` }} size={11} />
      <AsciiSpec spec={{ kind: "sparkline", cols: 40, rows: 5 }} state={{ values, label: "Payments / min" }} size={11} />
      <AsciiSpec
        spec={{ kind: "ticker", cols: 40 }}
        state={{ items: [{ label: "VOLUME", value: 1_200_000 + t * 1500, delta: Math.sin(t * 0.4) * 3 }, { label: "AUTH RATE", value: 98.4, delta: -0.2 }] }}
        size={11}
      />
    </div>
  );
}

export function Celebrate() {
  const [n, setN] = useState(0);
  return (
    <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      {/* a new key starts it from the beginning */}
      <AsciiSpec key={n} spec={{ kind: "celebrate", cols: 40, rows: 12, message: "Payment approved", style: (["check", "confetti", "fireworks"] as const)[n % 3] }} size={10} />
      <button className="button" onClick={() => setN((x) => x + 1)}>Again</button>
    </div>
  );
}

export function Sequence() {
  return (
    <AsciiSequence
      pieces={[{ ...mark, effect: "reveal" }, { kind: "text", text: "WELCOME", effect: "scramble", cols: mark.cols, rows: mark.rows }]}
      hold={[3.5, 3]}
      kind="melt"
      duration={1}
      size={9}
    />
  );
}

export function Clip() {
  return <AsciiClip src="/mandelbrot.amc" size={8} />;
}

export function Webcam() {
  const [on, setOn] = useState(false);
  return (
    <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      {on ? <AsciiWebcam cols={64} size={8} /> : <p style={{ color: "var(--muted)" }}>The camera stays off until you ask.</p>}
      <button className="button" onClick={() => setOn((x) => !x)}>{on ? "Stop camera" : "Start camera"}</button>
    </div>
  );
}
