import { Brand, Dashboard, Celebrate, Sequence, Clip, Webcam } from "./Demos";

export default function ExtrasPage() {
  return (
    <>
      <h1>Extras</h1>
      <p style={{ color: "var(--muted)" }}>
        Pieces made from data with <code>ascii-magic-art-react/extras</code>. The logo is a spec from{" "}
        <code>ama-studio brand mark.svg --effect assemble</code>; the clip is a video from <code>ama-studio convert</code>. WebGPU shaders as ASCII are on <a href="/extras/shader">their own page</a>.
      </p>
      <div className="grid">
        <div className="card"><Brand /><h2>AsciiSpec: a logo, with replay</h2></div>
        <div className="card"><Dashboard /><h2>progress, sparkline and ticker, fed state</h2></div>
        <div className="card"><Celebrate /><h2>celebrate</h2></div>
        <div className="card"><Sequence /><h2>AsciiSequence: logo, melt, text</h2></div>
        <div className="card"><Clip /><h2>AsciiClip: an .amc clip</h2></div>
        <div className="card"><Webcam /><h2>AsciiWebcam</h2></div>
      </div>
    </>
  );
}
