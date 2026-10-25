/// <reference path="../types/pieces.d.ts" preserve="true" />
/*
 * ascii-magic-art-react/server: for React Server Components (the Next.js App Router).
 * The piece loads on the server and its first frame goes into the HTML, so it
 * shows before any JS runs and search engines see it; the client picks up the
 * animation from there.
 *
 *   import { AsciiArt } from "ascii-magic-art-react/server";
 *   export default function Page() { return <AsciiArt piece="moonlit-sea" />; }
 *
 * Use these, not the client AsciiArt/AsciiPlayer, when passing a piece module from a
 * Server Component: a module holds functions, and those can't be sent to the client.
 */
import { AsciiArt as ClientAsciiArt, type AsciiArtProps } from "./client/AsciiArt.js";
import { AsciiHero as ClientAsciiHero, type AsciiHeroProps } from "./client/AsciiHero.js";
import { pickLook, toLook, type LookProps } from "./core/look.js";
import { firstFrameHTML } from "./core/prerender.js";
import { isSlug, loadPiece } from "./core/resolve.js";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import type { PieceSlug } from "./registry/sizes.generated.js";

/** A piece by name, or a library piece module (it travels to the client by name). */
export type ServerPieceRef = PieceSlug | PieceModule;

/** Functions can't cross from a Server Component to the client, so the callbacks are left out. */
export type ServerAsciiArtProps = Omit<AsciiArtProps, "piece" | "prerendered" | "onFrame" | "onReady" | "onError"> & {
  piece: ServerPieceRef;
};

/*
 * A module is full of functions, which can't be sent to a Client Component. A library
 * piece doesn't need to be: its name is enough. A custom piece (definePiece) has to be
 * played from a "use client" file instead.
 */
function slugFor(piece: ServerPieceRef): PieceSlug {
  if (typeof piece === "string") return piece;
  const slug = piece.meta.slug;
  if (isSlug(slug)) return slug;
  throw new Error(
    `ascii-magic-art-react: "${slug}" is not a library piece, so it can't be sent from a Server Component. ` +
      `Render <AsciiPlayer piece={...} /> from a file that starts with "use client".`,
  );
}

async function prerender(slug: PieceSlug, rest: LookProps & { ssr?: boolean; t0?: number }): Promise<string | null> {
  if (rest.ssr === false) return null;
  // A bad slug still renders: the client shows it as a failed load, not the whole page as an error.
  try { return firstFrameHTML(await loadPiece(slug), toLook(pickLook(rest)), rest.t0); } catch { return null; }
}

export async function AsciiArt({ piece, ...rest }: ServerAsciiArtProps) {
  const slug = slugFor(piece);
  return <ClientAsciiArt piece={slug} prerendered={await prerender(slug, rest)} {...rest} />;
}

export type ServerAsciiHeroProps = Omit<AsciiHeroProps, "piece" | "prerendered" | "onFrame" | "onReady" | "onError"> & {
  piece: ServerPieceRef;
};

/** AsciiHero with the first frame in the server HTML. Children can be Server Components. */
export async function AsciiHero({ piece, ...rest }: ServerAsciiHeroProps) {
  const slug = slugFor(piece);
  return <ClientAsciiHero piece={slug} prerendered={await prerender(slug, rest)} {...rest} />;
}

export { firstFrameHTML, boxSize } from "./core/prerender.js";
export { loadPiece, sizeOf, isSlug } from "./core/resolve.js";
export type { PieceSlug } from "./registry/sizes.generated.js";
