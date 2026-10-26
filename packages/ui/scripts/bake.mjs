/*
 * Bake the shader components' scenes to clips, for browsers without WebGPU.
 *
 *   npm run bake -w packages/ui [-- nebula-sky cursor-field ...]
 *
 * Needs Chromium or Chrome with WebGPU ($CHROME, one on the PATH, or the macOS app).
 * Each scene is baked a second longer than the loop and the extra second is
 * crossfaded into the start, so the clip loops without a jump. Writes
 * src/components/<name>/clip*.ts (base64 .amc) and lumino-holo/logo.ts.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { bakeFrames } from "../../studio/src/bake.js";
import { framesClip } from "../../studio/src/video.js";
import { MASK } from "../src/components/lumino-donut/mask.ts";

const ui = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(ui, "src/components");
const sharp = createRequire(import.meta.url)("sharp");

const COLS = 80, FPS = 12, SECONDS = 6, FADE = 1, COLORS = 24;
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!process.env.CHROME && fs.existsSync(MAC_CHROME)) process.env.CHROME = MAC_CHROME;

// [component, clip file, scene props]
const JOBS = [
  ["nebula-sky", "clip.ts", {}],
  ["cursor-field", "clip-flow.ts", { variant: "flow" }],
  ["cursor-field", "clip-filings.ts", { variant: "filings" }],
  ["cursor-field", "clip-bloom.ts", { variant: "bloom" }],
  ["lumino-holo", "clip.ts", {}],
];

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

/** Blend the frames past the loop into its first second, so the last frame leads into the first. */
function loop(frames, n, f) {
  return frames.slice(0, n).map((a, j) => {
    if (j >= f) return a;
    const b = frames[n + j], k = j / f, out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = b[i] + (a[i] - b[i]) * k;
    return out;
  });
}

const only = process.argv.slice(2);
await writeLogo();
const tmp = path.join(ui, ".bake");
fs.mkdirSync(tmp, { recursive: true });
try {
  for (const [name, file, props] of JOBS) {
    if (only.length && !only.includes(name)) continue;
    const entry = path.join(tmp, `${name}-${file.replace(/\.ts$/, "")}.jsx`);
    fs.writeFileSync(entry, `import Scene from ${JSON.stringify(path.join(src, name, "scene.tsx"))};\nexport default () => <Scene {...${JSON.stringify(props)}} />;\n`);
    const n = FPS * SECONDS, f = FPS * FADE;
    const v = await bakeFrames({ file: entry }, { cols: COLS, fps: FPS, seconds: SECONDS + FADE });
    const { bytes } = framesClip({ ...v, frames: loop(v.frames, n, f) }, { colors: COLORS, fps: FPS, name });
    fs.writeFileSync(path.join(src, name, file),
      `// ${name}'s scene baked by scripts/bake.mjs (${v.cols}x${v.rows} cells, ${SECONDS} s at ${FPS} fps), for browsers without WebGPU. Do not edit.\nexport const CLIP = "${Buffer.from(bytes).toString("base64")}";\n`);
    console.log(`${name}/${file}: ${v.cols}x${v.rows}, ${(bytes.length / 1024).toFixed(0)} KB`);
  }
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
