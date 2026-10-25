import { AsciiLoader } from "ascii-magic-art-react";

export default function Loading() {
  return <AsciiLoader variant="torus" size={10} description="Loading…" style={{ marginTop: "3rem" }} />;
}
