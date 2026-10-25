/*
 * piecejs.js: a spec as one self-contained piece module, with the extras and the
 * kit bundled in. Drop it next to your code and import it like a library piece:
 *   import * as logo from "./logo.piece.js";  // { meta, default }
 */
import * as esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

export async function pieceModule(spec) {
  const contents = `import { make } from "ascii-magic-art-extras";
const p = make(${JSON.stringify(spec)});
export const meta = p.meta;
export default p.create;
`;
  const r = await esbuild.build({
    stdin: { contents, resolveDir: path.dirname(fileURLToPath(import.meta.url)), loader: "js" },
    bundle: true, write: false, format: "esm", target: "es2019", minify: true, legalComments: "none",
  });
  return `/* ${spec.name || spec.kind}: made with ama-studio (ascii-magic-art-studio). */\n` + r.outputFiles[0].text;
}
