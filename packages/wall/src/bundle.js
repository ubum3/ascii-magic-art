/*
 * bundle.js: web/app.jsx as one browser script, with esbuild. `npm run build`
 * writes it to dist/app.js; ama-wall serves that, or bundles in memory without it.
 * ascii-magic-art-react resolves to its dist/, so build that package first.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DIST_APP = path.join(ROOT, "dist", "app.js");

export async function bundleApp({ minify = true } = {}) {
  const esbuild = await import("esbuild");
  const out = await esbuild.build({
    entryPoints: [path.join(ROOT, "web", "app.jsx")],
    bundle: true, write: false, format: "esm", target: "es2020", minify, jsx: "automatic",
    define: { "process.env.NODE_ENV": '"production"' }, legalComments: "none",
  });
  return out.outputFiles[0].text;
}

/** The page script: dist/app.js when built, else bundled now. */
export async function appScript() {
  try { return fs.readFileSync(DIST_APP, "utf8"); } catch { return bundleApp(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.mkdirSync(path.dirname(DIST_APP), { recursive: true });
  fs.writeFileSync(DIST_APP, await bundleApp());
  console.log(`${path.relative(process.cwd(), DIST_APP)}  ${(fs.statSync(DIST_APP).size / 1024).toFixed(0)} KB`);
}
