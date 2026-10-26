/*
 * Bake shader scenes to clips, for browsers without WebGPU. Used by this package's
 * scripts/bake.mjs and by packages/lumino-ui's.
 *
 * Needs Chromium or Chrome with WebGPU ($CHROME, one on the PATH, or the macOS app).
 * Each scene is baked a second longer than the loop and the extra second is
 * crossfaded into the start, so the clip loops without a jump. Writes
 * <src>/<name>/clip*.ts (base64 .amc).
 */
import fs from "node:fs";
import path from "node:path";
import { bakeFrames } from "../../studio/src/bake.js";
import { framesClip } from "../../studio/src/video.js";

const COLS = 80, FPS = 12, SECONDS = 6, FADE = 1, COLORS = 24;
const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
if (!process.env.CHROME && fs.existsSync(MAC_CHROME)) process.env.CHROME = MAC_CHROME;

/** Blend the frames past the loop into its first second, so the last frame leads into the first. */
function loop(frames, n, f) {
  return frames.slice(0, n).map((a, j) => {
    if (j >= f) return a;
    const b = frames[n + j], k = j / f, out = new Uint8Array(a.length);
    for (let i = 0; i < a.length; i++) out[i] = b[i] + (a[i] - b[i]) * k;
    return out;
  });
}

/**
 * Bake each [component, clip file, scene props] job whose component is in `only`
 * (or every job, when `only` is empty). `src` is the package's src/components.
 */
export async function bakeClips(src, jobs, only = []) {
  const tmp = path.join(src, "../../.bake");
  fs.mkdirSync(tmp, { recursive: true });
  try {
    for (const [name, file, props] of jobs) {
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
}
