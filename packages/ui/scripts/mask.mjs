/*
 * Rasterise a logo (SVG or PNG with transparency) to a mask module for a piece.
 *
 *   npm run mask -w packages/ui -- logo.svg src/components/<name>/mask.ts [size=96]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const [file, out, size = "96"] = process.argv.slice(2);
if (!file || !out) {
  console.error("usage: node scripts/mask.mjs <logo.svg|png> <out.ts> [size]");
  process.exit(1);
}
const N = Number(size);
// Render big (SVGs carry no size we can trust), trim the empty margin, fit into N x N.
const meta = await sharp(file).metadata();
const density = Math.min(600, (72 * 2048) / Math.max(meta.width || 1, meta.height || 1));
const trimmed = await sharp(file, { density }).ensureAlpha().trim({ threshold: 10 }).png().toBuffer();
const { data, info } = await sharp(trimmed)
  .resize(N, N, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const rows = [];
for (let y = 0; y < info.height; y++) {
  let r = "";
  for (let x = 0; x < info.width; x++) r += data[(y * info.width + x) * 4 + 3] > 110 ? "#" : ".";
  rows.push(r);
}
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, `// ${N} x ${N} mask of ${path.basename(file)} (# is the logo). Made by scripts/mask.mjs; do not edit.
export const MASK: readonly string[] = [
${rows.map((r) => `  "${r}",`).join("\n")}
];
`);
console.log(`${out}: ${N} x ${N}, ${rows.join("").split("#").length - 1} cells set`);
