"use client";
import { useState } from "react";
import { LuminoRandomBackground } from "lumino-ui/backgrounds";
import { Card } from "./Card";

export function SignIn({ pick }: { pick?: string }) {
  const [name, setName] = useState("");
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
      <LuminoRandomBackground pick={pick} dim={0.35} onPick={(b) => setName(b.name)}>
        <Card />
        <div style={{ position: "absolute", left: 16, bottom: 12, color: "rgba(255,255,255,0.55)", font: "13px system-ui, sans-serif" }}>
          {name} · <a href="/sign-in" style={{ color: "inherit" }}>shuffle</a> · <a href="/lumino-bg" style={{ color: "inherit" }}>all</a>
        </div>
      </LuminoRandomBackground>
    </div>
  );
}
