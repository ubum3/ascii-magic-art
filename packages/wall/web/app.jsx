/*
 * The wall's page: the layout from /layout.json, sized to this screen, played by
 * React with the state streamed from /state. One piece, one state.
 */
import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { AsciiPlayer } from "ascii-magic-art-react";
import { useSpecPiece } from "ascii-magic-art-react/extras";

const CELL_W = 0.6; // a monospace cell is about 0.6 of its height

function cellsForWindow() {
  // the default layout at a size whose cells come out near 18px tall on this screen
  const rows = Math.max(18, Math.min(60, Math.round(innerHeight / 18)));
  const cols = Math.max(48, Math.min(240, Math.round((innerWidth / (innerHeight / rows)) / CELL_W)));
  return { cols, rows };
}

/** The font size (px) that fits cols x rows in the window. */
const fit = ({ cols, rows }) => Math.floor(Math.min(innerWidth / (cols * CELL_W), innerHeight / rows) * 10) / 10;

function Screen({ layout, state }) {
  const piece = useSpecPiece(layout, state);
  const [size, setSize] = useState(() => fit(layout));
  useEffect(() => {
    const on = () => setSize(fit(layout));
    addEventListener("resize", on);
    return () => removeEventListener("resize", on);
  }, [layout]);
  return (
    <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <AsciiPlayer piece={piece} size={size} bg="#0d1117" maxFps={30} label="Live payments wall" />
    </div>
  );
}

function Wall() {
  const [layout, setLayout] = useState();
  const [state, setState] = useState({});
  useEffect(() => {
    const { cols, rows } = cellsForWindow();
    fetch(`/layout.json?cols=${cols}&rows=${rows}`).then((r) => r.json()).then(setLayout);
    const es = new EventSource("/state");
    es.onmessage = (e) => { try { setState(JSON.parse(e.data)); } catch { /* a bad message: keep the last state */ } };
    return () => es.close();
  }, []);
  if (!layout) return null;
  return <Screen layout={layout} state={state} />;
}

createRoot(document.getElementById("wall")).render(<Wall />);
