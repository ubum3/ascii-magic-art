import { Badge, FrameAsState } from "./Demos";

export default function CustomPage() {
  return (
    <>
      <h1>Custom pieces</h1>
      <div className="grid">
        <div className="card"><Badge /><h2>definePiece + AsciiPlayer</h2></div>
        <div className="card"><FrameAsState /><h2>useAsciiFrame, letters look</h2></div>
      </div>
    </>
  );
}
