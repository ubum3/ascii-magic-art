import { AuroraShader, PlasmaShader, SwirlShader, Fallback } from "./Demos";

export default function ShaderPage() {
  return (
    <>
      <h1>Shaders</h1>
      <p style={{ color: "var(--muted)" }}>
        WebGPU shaders from the <code>shaders</code> package, played as ASCII by <code>AsciiShader</code> from{" "}
        <code>ascii-magic-art-react/shader</code>. Without WebGPU each one shows its fallback.
      </p>
      <div className="grid">
        <div className="card"><AuroraShader /><h2>Aurora and FilmGrain, square cells</h2></div>
        <div className="card"><PlasmaShader /><h2>Plasma, text cells in the ASCII look</h2></div>
        <div className="card"><SwirlShader /><h2>Swirl, interactive</h2></div>
        <div className="card"><Fallback /><h2>The fallback, when WebGPU is unavailable</h2></div>
      </div>
    </>
  );
}
