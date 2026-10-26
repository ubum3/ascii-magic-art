import { LuminoSpace } from "ascii";

export default function SpacePage() {
  return (
    <LuminoSpace dim={0.15} style={{ height: "80vh", borderRadius: 12 }}>
      <div style={{ display: "grid", placeItems: "center", height: "100%", color: "#fff", textAlign: "center" }}>
        <div>
          <h1 style={{ fontSize: "3rem", margin: 0 }}>Lumino</h1>
          <p style={{ opacity: 0.7 }}>Brandmarks for stars.</p>
        </div>
      </div>
    </LuminoSpace>
  );
}
