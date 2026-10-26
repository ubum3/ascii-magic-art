/*
 * video.js: a video or animated GIF to an .amc clip, with ffmpeg. Frames are
 * scaled to the grid by ffmpeg, share one palette (picked from frames across the
 * whole clip) and are stored as the same blocks lib/image.js draws.
 */
import { spawnSync } from "child_process";
import zlib from "zlib";
import { restyle } from "ascii-magic-art/runtime/glyphs.js";
import { buildPalette, cellsFromPixels, cellsFrame, encodeClip, gridSize } from "ascii-magic-art-extras";

export function hasFfmpeg() {
  try { return spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0; } catch { return false; }
}

function probe(file) {
  const r = spawnSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "json", file], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe could not read ${file}: ${r.stderr.trim()}`);
  const s = JSON.parse(r.stdout).streams[0];
  if (!s) throw new Error(`${file} has no video`);
  return [s.width, s.height];
}

/** Frames as { cols, rows, frames: RGBA buffers }. */
export function decodeVideo(file, { cols = 80, rows, square = true, fps = 12, seconds = 10, start = 0 } = {}) {
  if (!hasFfmpeg()) throw new Error("video and GIF need ffmpeg on your PATH (https://ffmpeg.org/download.html)");
  const [w, h] = probe(file);
  const [c, r] = rows ? [cols, rows] : gridSize(w, h, cols, square);
  const args = ["-v", "error", ...(start ? ["-ss", String(start)] : []), "-i", file, "-t", String(seconds),
    "-vf", `fps=${fps},scale=${c}:${r}:flags=area`, "-f", "rawvideo", "-pix_fmt", "rgba", "pipe:1"];
  const out = spawnSync("ffmpeg", args, { maxBuffer: 1 << 30 });
  if (out.status !== 0) throw new Error(`ffmpeg failed: ${out.stderr.toString().trim()}`);
  const size = c * r * 4, frames = [];
  for (let i = 0; i + size <= out.stdout.length; i += size) frames.push(out.stdout.subarray(i, i + size));
  if (!frames.length) throw new Error(`no frames decoded from ${file}`);
  return { cols: c, rows: r, frames };
}

/** A video to clip bytes, plus what went into it. */
export function videoClip(file, { colors = 48, gamma = 1, look, name, fps = 12, loop = true, ...opts } = {}) {
  // A look redraws the blocks as text, so the grid is in text cells, not square pixels.
  if (look) opts.square = false;
  const v = decodeVideo(file, { fps, ...opts });
  return framesClip(v, { colors, gamma, look, name, fps, loop, square: opts.square });
}

/** RGBA frames ({ cols, rows, frames }) to clip bytes, plus what went into it. Shared by video and bake. */
export function framesClip(v, { colors = 48, gamma = 1, look, name, fps = 12, loop = true, square: sq } = {}) {
  const step = Math.max(1, Math.floor(v.frames.length / 24));
  const palette = buildPalette(v.frames.filter((_, i) => i % step === 0), colors);
  let pal = null;
  const frames = v.frames.map((px) => {
    const cells = cellsFromPixels(px, v.cols, v.rows, { palette, gamma });
    pal = cells.palette;
    const f = cellsFrame(cells);
    if (!look) return f;
    const r = restyle(f, cells.palette, look);
    if (typeof r === "string") return r;
    pal = r.palette || pal;
    return { text: r.text, color: r.color };
  });
  const square = sq !== false && !look;
  const header = { cols: v.cols, rows: v.rows, fps, palette: pal, square, loop, name };
  return { bytes: encodeClip(header, frames, (u) => zlib.deflateRawSync(u, { level: 9 })), header, frames };
}
