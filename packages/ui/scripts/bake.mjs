/*
 * Bake the shader components' scenes to clips, for browsers without WebGPU.
 *
 *   npm run bake -w packages/ui [-- nebula-sky cursor-field ...]
 *
 * Needs Chromium or Chrome with WebGPU (see scripts/bake-clips.mjs). Writes
 * src/components/<name>/clip*.ts (base64 .amc).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bakeClips } from "./bake-clips.mjs";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/components");

// [component, clip file, scene props]
const JOBS = [
  ["nebula-sky", "clip.ts", {}],
  ["cursor-field", "clip-flow.ts", { variant: "flow" }],
  ["cursor-field", "clip-filings.ts", { variant: "filings" }],
  ["cursor-field", "clip-bloom.ts", { variant: "bloom" }],
];

await bakeClips(src, JOBS, process.argv.slice(2));
