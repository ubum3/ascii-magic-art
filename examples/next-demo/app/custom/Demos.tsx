"use client";
import { useRef, useState } from "react";
import { AsciiPlayer, useAsciiFrame } from "ascii-magic-art-react";
import * as spinners from "ascii-magic-art/pieces/spinner-set.js";
import badge from "./build-badge";

// A custom piece is a module full of functions, so it plays from a client component.
export function Badge() {
  const [paused, setPaused] = useState(false);
  return (
    <div style={{ display: "grid", gap: "0.75rem", justifyItems: "start" }}>
      <AsciiPlayer piece={badge} size={16} paused={paused} />
      <button className="button" onClick={() => setPaused((p) => !p)}>{paused ? "Play" : "Pause"}</button>
    </div>
  );
}

// useAsciiFrame gives you the frame as React state, to put in your own markup.
export function FrameAsState() {
  const ref = useRef<HTMLPreElement>(null);
  const { html, t } = useAsciiFrame(spinners, { ref, look: "letters" });
  return (
    <div>
      <pre ref={ref} style={{ font: "9px/1 monospace", margin: 0 }} dangerouslySetInnerHTML={{ __html: html }} />
      <p style={{ color: "var(--muted)" }}>t = {t.toFixed(1)}s, rendered by React</p>
    </div>
  );
}
