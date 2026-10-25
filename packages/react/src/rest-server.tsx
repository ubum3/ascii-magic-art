/*
 * ascii-magic-art-react/rest/server: AsciiRest for React Server Components. The
 * piece loads on the server and its first frame goes into the HTML.
 *
 *   import { AsciiRest } from "ascii-magic-art-react/rest/server";
 *   export default function Page() { return <AsciiRest piece="night-coast" />; }
 */
import { restPiece } from "ascii-magic-art-rest";
import type { PieceModule } from "ascii-magic-art/lib/types.js";
import { AsciiRest as ClientAsciiRest, type AsciiRestProps } from "./rest.js";
import { pickLook, toLook } from "./core/look.js";
import { firstFrameHTML } from "./core/prerender.js";

export type ServerAsciiRestProps = Omit<AsciiRestProps, "prerendered" | "onFrame" | "onReady" | "onError"> & { ssr?: boolean };

export async function AsciiRest({ piece, ssr, ...rest }: ServerAsciiRestProps) {
  let html: string | null = null;
  if (ssr !== false) {
    try {
      html = firstFrameHTML((await restPiece(piece.startsWith("rest-") ? piece : "rest-" + piece)) as PieceModule, toLook(pickLook(rest)), rest.t0);
    } catch { html = null; }
  }
  return <ClientAsciiRest piece={piece} prerendered={html} {...rest} />;
}
