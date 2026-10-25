/*
 * export.js: a playable thing to files.
 *
 *   cast   asciicast v2 (asciinema), frames as ANSI text: tiny, crisp, copyable
 *   png    one frame, drawn by runtime/canvas.js exactly as the web player draws it
 *   gif / mp4 / webm   every frame drawn the same way, encoded by ffmpeg
 *   svg    one loop as an animated SVG, for READMEs (svg.js, through ascii.rest)
 *
 * Images use @napi-rs/canvas. runtime/canvas.js makes its glyph atlas with
 * document.createElement("canvas") and draws dots with Path2D; stand-ins for both
 * come from @napi-rs/canvas.
 */
import fs from "fs";
import { spawn } from "child_process";
import { createCanvas, GlobalFonts, Path2D } from "@napi-rs/canvas";
import { ansi, termSize } from "./ansi.js";
import { hasFfmpeg } from "./video.js";
import { toSvg } from "./svg.js";

if (!globalThis.document) globalThis.document = { createElement: () => createCanvas(1, 1) };
if (!globalThis.Path2D) globalThis.Path2D = Path2D;
const canvasLib = import("ascii-magic-art/runtime/canvas.js");

const frameTimes = (meta, seconds, fps) => {
  const n = meta.still ? 1 : Math.max(1, Math.round(seconds * fps));
  return Array.from({ length: n }, (_, i) => i / fps);
};

/** asciicast v2 text for `seconds` of play. */
export function toCast(src, { seconds = 6, fps, state, title } = {}) {
  const { meta, draw } = src;
  fps = Math.min(fps || meta.fps || 24, 30);
  const [w, h] = termSize(meta);
  const out = [JSON.stringify({ version: 2, width: w, height: h, timestamp: Math.floor(Date.now() / 1000), title: title || meta.name, env: { TERM: "xterm-256color" } })];
  const r = ansi({ color: true, truecolor: true });
  let last = "";
  out.push(JSON.stringify([0, "o", "\x1b[?25l\x1b[2J"]));
  for (const t of frameTimes(meta, seconds, fps)) {
    const s = "\x1b[H" + r.lines(draw(t, state), meta).join("\r\n");
    if (s === last) continue;
    last = s;
    out.push(JSON.stringify([Number(t.toFixed(4)), "o", s]));
  }
  out.push(JSON.stringify([Number(seconds.toFixed(4)), "o", "\x1b[?25h"]));
  return out.join("\n") + "\n";
}

/** The canvas size for a frame at `px` pixels per cell width, both sides even (for video codecs). */
async function sizeFor(meta, { width, height, preset, px = 16 }) {
  const { PRESETS, cellAspect } = await canvasLib;
  if (preset) {
    const p = PRESETS[preset];
    if (!p) throw new Error(`no preset "${preset}": ${Object.keys(PRESETS).join(", ")}`);
    return { width: p.width, height: p.height, fit: p.fit };
  }
  const aspect = cellAspect(meta), even = (v) => Math.max(2, Math.round(v / 2) * 2);
  const cw = width ? width / meta.cols : px * 0.602;
  const w = width || meta.cols * cw, h = height || meta.rows * cw * aspect;
  return { width: even(w * 1.04), height: even(h * 1.04), fit: "contain" };
}

/** Draw frames to RGBA buffers and hand each one to `each`. */
async function render(src, opts, each) {
  const { renderTo } = await canvasLib;
  const { meta, draw } = src;
  const fps = Math.min(opts.fps || meta.fps || 24, 30);
  const { width, height, fit } = await sizeFor(meta, opts);
  const canvas = createCanvas(width, height);
  const times = opts.at != null ? [opts.at] : frameTimes(meta, opts.seconds || 6, fps);
  for (const t of times) {
    const f = draw(t, opts.state);
    renderTo(canvas, f, (typeof f === "object" && f.palette) || meta.palette, { width, height, bg: opts.bg || "#09090b", fit, margin: 0.02, meta, look: opts.look || {} });
    await each(canvas, t);
  }
  return { width, height, fps, frames: times.length };
}

export async function toPng(src, file, opts = {}) {
  const at = opts.at ?? (src.meta.still ? 0 : 1.5);
  await render(src, { ...opts, at }, (canvas) => fs.writeFileSync(file, canvas.toBuffer("image/png")));
}

const CODECS = {
  mp4: ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18", "-preset", "medium", "-movflags", "+faststart"],
  webm: ["-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "32", "-row-mt", "1"],
  gif: ["-filter_complex", "split[a][b];[a]palettegen=stats_mode=diff:max_colors=200[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle", "-loop", "0"],
};

/** Encode a video or GIF with ffmpeg. */
export async function toVideo(src, file, format, opts = {}) {
  if (!hasFfmpeg()) throw new Error(`${format} export needs ffmpeg on your PATH (https://ffmpeg.org/download.html)`);
  const { meta } = src;
  const fps = Math.min(opts.fps || meta.fps || 24, format === "gif" ? 25 : 30);
  const { width, height } = await sizeFor(meta, opts);
  const ff = spawn("ffmpeg", ["-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgba", "-s", `${width}x${height}`, "-r", String(fps), "-i", "pipe:0", ...CODECS[format], file], { stdio: ["pipe", "ignore", "pipe"] });
  let err = "";
  ff.stderr.on("data", (d) => (err += d));
  const done = new Promise((res, rej) => ff.on("close", (code) => (code === 0 ? res() : rej(new Error(`ffmpeg failed: ${err.trim()}`)))));
  const info = await render(src, { ...opts, fps }, async (canvas) => {
    const px = canvas.getContext("2d").getImageData(0, 0, width, height).data;
    if (!ff.stdin.write(Buffer.from(px.buffer, px.byteOffset, px.byteLength))) await new Promise((r) => ff.stdin.once("drain", r));
  });
  ff.stdin.end();
  await done;
  return info;
}

export const FORMATS = ["cast", "png", "gif", "mp4", "webm", "svg"];

/** Export by file extension. */
export async function exportTo(src, file, opts = {}) {
  const format = (opts.format || file.split(".").pop()).toLowerCase();
  // A piece with its own ground (ascii.rest scenes) is drawn on it unless told otherwise.
  if (opts.bg == null && src.meta.bg) opts = { ...opts, bg: src.meta.bg };
  if (format === "svg") { const r = toSvg(src, file, opts); if (r.snippet) opts.onSnippet?.(r.snippet); return format; }
  if (format === "cast") { fs.writeFileSync(file, toCast(src, opts)); return format; }
  if (format === "png") { await toPng(src, file, opts); return format; }
  if (CODECS[format]) { await toVideo(src, file, format, opts); return format; }
  throw new Error(`can't export .${format}: use one of ${FORMATS.join(", ")}`);
}

export { GlobalFonts };
