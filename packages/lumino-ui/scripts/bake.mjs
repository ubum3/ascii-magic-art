/*
 * Bake LuminoHolo's scene to a clip, for browsers without WebGPU, and write its logo.
 *
 *   npm run bake -w packages/lumino-ui
 *
 * Needs Chromium or Chrome with WebGPU (see packages/ui/scripts/bake-clips.mjs).
 * Writes src/components/lumino-holo/clip.ts (base64 .amc) and lumino-holo/logo.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { bakeClips } from "../../ui/scripts/bake-clips.mjs";
import { MASK } from "../src/components/lumino-donut/mask.ts";

const src = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/components");
const sharp = createRequire(import.meta.url)("sharp");

/** lumino-holo's logo: the mask as a white PNG with a transparent margin, as a data URL. */
async function writeLogo() {
  const N = MASK.length, PAD = 12, S = N + PAD * 2, px = Buffer.alloc(S * S * 4);
  MASK.forEach((row, y) => [...row].forEach((c, x) => {
    const i = ((y + PAD) * S + x + PAD) * 4;
    px.fill(255, i, i + 3);
    px[i + 3] = c === "#" ? 255 : 0;
  }));
  const png = await sharp(px, { raw: { width: S, height: S, channels: 4 } }).png({ compressionLevel: 9 }).toBuffer();
  fs.writeFileSync(path.join(src, "lumino-holo/logo.ts"),
    `// lumino-donut's mask as a white PNG (RGBA: ImageTexture can't read a grey PNG), written by scripts/bake.mjs.\nexport const LOGO_PNG = "data:image/png;base64,${png.toString("base64")}";\n`);
}

await writeLogo();
await bakeClips(src, [["lumino-holo", "clip.ts", {}]]);
