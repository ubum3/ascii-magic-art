import type { CSSProperties } from "react";
import { Brandmark, LUMINO_GRADIENT } from "lumino-ui/brand";

const field: CSSProperties = {
  width: "100%", boxSizing: "border-box", padding: "12px 14px", borderRadius: 10, border: "1px solid rgba(255,255,255,0.12)",
  background: "rgba(10,10,12,0.55)", color: "#fff", fontSize: 15, outline: "none",
};

/** A mock sign-in card: frosted glass with a thin brand-gradient border, centred in its box. */
export function Card() {
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", padding: 16, boxSizing: "border-box" }}>
      <form
        style={{
          width: "min(380px, 100%)", padding: 32, borderRadius: 20, color: "#fff", display: "grid", gap: 14,
          background: `linear-gradient(rgba(20,20,22,0.62), rgba(20,20,22,0.62)) padding-box, ${LUMINO_GRADIENT} border-box`,
          border: "1px solid transparent", backdropFilter: "blur(18px) saturate(1.2)", WebkitBackdropFilter: "blur(18px) saturate(1.2)",
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)", fontFamily: "system-ui, sans-serif",
        }}
      >
        <Brandmark tight fill="#fff" style={{ width: 40, height: 35 }} />
        <h1 style={{ margin: "6px 0 4px", fontSize: 22, fontWeight: 600 }}>Sign in to Lumino</h1>
        <input style={field} type="email" placeholder="Email" aria-label="Email" />
        <input style={field} type="password" placeholder="Password" aria-label="Password" />
        <button type="button" style={{ ...field, cursor: "pointer", border: "none", background: "#fff", color: "#111013", fontWeight: 600 }}>
          Continue
        </button>
      </form>
    </div>
  );
}
