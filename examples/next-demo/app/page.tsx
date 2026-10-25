import { AsciiArt } from "ascii-magic-art-react/server";
import type { PieceSlug } from "ascii-magic-art-react";
import type { LookName } from "ascii-magic-art-react";

// A Server Component: every first frame is in the HTML, and each piece's code loads as its own chunk.
const SHOWCASE: { piece: PieceSlug; look?: LookName; mono?: boolean }[] = [
  { piece: "spinning-torus" },
  { piece: "matrix-rain" },
  { piece: "sleeping-cat" },
  { piece: "moonlit-sea", look: "dots" },
  { piece: "game-of-life", look: "numbers" },
  { piece: "heart-3d", mono: true },
  { piece: "ocean-sunset" },
  { piece: "double-pendulum" },
  { piece: "goldfish-tank", look: "blocks" },
];

export default function Gallery() {
  return (
    <>
      <h1>Gallery</h1>
      <div className="grid">
        {SHOWCASE.map((s) => (
          <div className="card" key={s.piece + (s.look ?? "")}>
            <AsciiArt piece={s.piece} look={s.look} mono={s.mono} size={9} />
            <h2>{s.piece}{s.look ? ` · ${s.look}` : ""}{s.mono ? " · mono" : ""}</h2>
          </div>
        ))}
      </div>
    </>
  );
}
