/*
 * bake.js: a WebGPU shader to an .amc clip, so it plays where there is no GPU (a
 * terminal, Rust, Go, a page without WebGPU). The scene is bundled with esbuild,
 * opened in headless Chromium with WebGPU on (software rendering is fine), and the
 * page posts each frame back to a small local server as RGBA at the grid size. No
 * browser driver is needed.
 *
 * The scene is either a module whose default export is a <Shader> element or a
 * component that renders one, or a list of shaders/react names ("Aurora,FilmGrain").
 * React, react-dom and shaders are resolved from the scene (or the working directory).
 */
import fs from "fs";
import os from "os";
import path from "path";
import http from "http";
import { spawn, spawnSync } from "child_process";
import { gridSize } from "ascii-magic-art-extras";
import { framesClip } from "./video.js";

const BROWSERS = ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome", "chrome"];

/** The Chromium to use: $CHROME, or the first one on the PATH. */
export function findChromium() {
  if (process.env.CHROME) return process.env.CHROME;
  for (const b of BROWSERS) {
    try { if (spawnSync(b, ["--version"], { stdio: "ignore" }).status === 0) return b; } catch { /* next */ }
  }
  return null;
}

/** The page's entry: render the scene on our clock, and post `count` frames as they are drawn. */
function entry(scene) {
  const names = scene.file ? [] : scene.names;
  const imports = scene.file
    ? `import Scene from ${JSON.stringify("./" + path.basename(scene.file))};`
    : `import { Shader, ${names.join(", ")} } from "shaders/react";`;
  const tree = scene.file
    ? "typeof Scene === 'function' ? React.createElement(Scene) : Scene"
    : `React.createElement(Shader, null, ${names.map((n) => `React.createElement(${n})`).join(", ")})`;
  return `
import React from "react";
import { createRoot } from "react-dom/client";
${imports}
const { cols, rows, fps, count } = window.__BAKE__;
const post = (p, body) => fetch(p, { method: "POST", body });

// Headless Chromium cannot present a WebGPU canvas, and reading one back gives blank
// pixels. So a configured canvas renders into a texture of ours, copied out by hand.
const live = new Set();
const P = GPUCanvasContext.prototype;
P.configure = function (cfg) { this.__ama?.texture?.destroy(); this.__ama = { ...cfg, alphaMode: cfg.alphaMode ?? "opaque", texture: null }; live.add(this.__ama); };
P.unconfigure = function () { this.__ama?.texture?.destroy(); live.delete(this.__ama); this.__ama = null; };
P.getConfiguration = function () { if (!this.__ama) return null; const { texture, ...cfg } = this.__ama; return cfg; };
P.getCurrentTexture = function () {
  const st = this.__ama;
  if (!st) throw new DOMException("the canvas is not configured", "InvalidStateError");
  const w = this.canvas.width, h = this.canvas.height;
  if (!st.texture || st.texture.width !== w || st.texture.height !== h) {
    st.texture?.destroy();
    st.texture = st.device.createTexture({
      size: [w, h], format: st.format, viewFormats: st.viewFormats ?? [],
      usage: (st.usage ?? GPUTextureUsage.RENDER_ATTACHMENT) | GPUTextureUsage.COPY_SRC,
    });
  }
  return st.texture;
};

// The shader's clock is ours: it moves 1/fps per frame, however slow the GPU is.
let clock = 0;
const raf = window.requestAnimationFrame.bind(window);
performance.now = () => clock;
window.requestAnimationFrame = (cb) => raf(() => cb(clock));
const frame = () => new Promise((ok) => raf(ok));

/** The texture's pixels as straight-alpha RGBA, or null while nothing is drawn. */
async function read({ device, format, alphaMode, texture: t }) {
  if (!/^(rgba|bgra)8unorm/.test(format)) throw new Error("bake reads 8-bit canvases, not " + format);
  const w = t.width, h = t.height, row = Math.ceil((w * 4) / 256) * 256;
  const buf = device.createBuffer({ size: row * h, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ });
  const enc = device.createCommandEncoder();
  enc.copyTextureToBuffer({ texture: t }, { buffer: buf, bytesPerRow: row }, [w, h]);
  device.queue.submit([enc.finish()]);
  await buf.mapAsync(GPUMapMode.READ);
  const src = new Uint8Array(buf.getMappedRange()), img = new ImageData(w, h), d = img.data;
  const bgr = format.startsWith("bgra"), pre = alphaMode === "premultiplied", opaque = alphaMode === "opaque";
  let seen = false;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * row + x * 4, o = (y * w + x) * 4, a = opaque ? 255 : src[i + 3];
    const k = pre && a && a < 255 ? 255 / a : 1;
    d[o] = src[i + (bgr ? 2 : 0)] * k; d[o + 1] = src[i + 1] * k; d[o + 2] = src[i + (bgr ? 0 : 2)] * k; d[o + 3] = a;
    seen ||= !!(src[i] | src[i + 1] | src[i + 2] | src[i + 3]);
  }
  buf.unmap(); buf.destroy();
  return seen ? img : null;
}

let el = ${tree};
// Telemetry off and sRGB, as AsciiShader does; and a way to hear that WebGPU is missing.
el = React.cloneElement(el, {
  disableTelemetry: true, colorSpace: el.props.colorSpace ?? "srgb",
  style: { width: "100%", height: "100%", ...el.props.style },
  onUnavailable: (r) => post("/fail", "WebGPU is unavailable: " + String((r && r.message) || r)),
});
window.addEventListener("error", (e) => post("/fail", String(e.message)));
window.addEventListener("unhandledrejection", (e) => post("/fail", String((e.reason && e.reason.message) || e.reason)));
createRoot(document.getElementById("stage")).render(el);

const full = document.createElement("canvas"), grid = document.createElement("canvas");
grid.width = cols; grid.height = rows;
const fctx = full.getContext("2d"), gctx = grid.getContext("2d", { willReadFrequently: true });
(async () => {
  for (let n = 0; n < count;) {
    await frame(); await frame(); // the shader draws at this clock
    const st = [...live].find((s) => s.texture);
    const img = st && (await read(st));
    if (!img) continue; // still compiling: the clock waits at 0
    full.width = img.width; full.height = img.height;
    fctx.putImageData(img, 0, 0);
    gctx.clearRect(0, 0, cols, rows);
    gctx.imageSmoothingQuality = "high";
    gctx.drawImage(full, 0, 0, cols, rows);
    await post("/frame/" + n++, gctx.getImageData(0, 0, cols, rows).data);
    clock += 1000 / fps;
  }
  post("/done", "");
})().catch((e) => post("/fail", String(e.message || e)));
`;
}

/**
 * Frames ({ cols, rows, frames: RGBA buffers }) from a shader scene. The shader runs
 * on a clock that steps 1/fps per frame, so a slow (software) GPU only takes longer.
 * `scene` is { file } or { names: ["Aurora", "FilmGrain"] }.
 */
export async function bakeFrames(scene, { cols = 80, rows, square = true, fps = 12, seconds = 6, timeout, chromium } = {}) {
  const browser = chromium || findChromium();
  if (!browser) throw new Error("bake needs Chromium (set $CHROME, or put chromium on your PATH)");
  const [c, r] = rows ? [cols, rows] : gridSize(16, 9, cols, square);
  const count = Math.max(1, Math.round(fps * seconds));

  const { build } = await import("esbuild");
  const dir = scene.file ? path.dirname(path.resolve(scene.file)) : process.cwd();
  const bundle = await build({
    stdin: { contents: entry(scene), resolveDir: dir, loader: "jsx" },
    bundle: true, write: false, format: "esm", jsx: "automatic", minify: true, logLevel: "silent",
    nodePaths: [path.join(process.cwd(), "node_modules")],
    define: { "process.env.NODE_ENV": '"production"' },
  }).catch((e) => { throw new Error(`could not bundle the scene: ${e.errors?.[0]?.text ?? e.message}`); });
  const js = bundle.outputFiles[0].text;

  // The page is the shader's size in pixels: 8 per cell, so it is never sampled from a blur.
  const W = Math.min(1280, c * 8), H = Math.round(W * (square ? r : r * 2) / c);
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}#stage{width:${W}px;height:${H}px}</style>
<div id="stage"></div><script>window.__BAKE__=${JSON.stringify({ cols: c, rows: r, fps, count })}</script><script type="module" src="/app.js"></script>`;

  const frames = new Array(count);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "ama-bake-"));
  let child, server;
  try {
    const result = new Promise((resolve, reject) => {
      server = http.createServer((req, res) => {
        const chunks = [];
        req.on("data", (d) => chunks.push(d));
        req.on("end", () => {
          const body = Buffer.concat(chunks);
          if (process.env.AMA_BAKE_DEBUG) console.error(req.method, req.url, body.length);
          if (req.method === "GET" && req.url === "/") { res.writeHead(200, { "content-type": "text/html" }); return res.end(html); }
          if (req.method === "GET" && req.url === "/app.js") { res.writeHead(200, { "content-type": "text/javascript" }); return res.end(js); }
          res.end();
          const m = /^\/frame\/(\d+)$/.exec(req.url);
          if (m && body.length === c * r * 4) frames[+m[1]] = body;
          else if (req.url === "/done") resolve();
          else if (req.url === "/fail") reject(new Error(body.toString() || "the shader failed"));
        });
      });
      server.listen(0, "127.0.0.1", () => {
        child = spawn(browser, [
          "--headless=new", "--enable-unsafe-webgpu", "--no-first-run", "--no-default-browser-check", "--mute-audio",
          "--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows",
          `--user-data-dir=${profile}`, `--window-size=${W},${H}`, `http://127.0.0.1:${server.address().port}/`,
        ], { stdio: process.env.AMA_BAKE_DEBUG ? ["ignore", "inherit", "inherit"] : "ignore" });
        child.on("error", (e) => reject(new Error(`could not start ${browser}: ${e.message}`)));
        child.on("exit", (code) => reject(new Error(`${browser} exited (${code}) before the shader finished`)));
      });
    });
    const limit = timeout ?? 60000 + seconds * 4000;
    let timer;
    await Promise.race([result, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`no frames after ${limit / 1000}s: is WebGPU working in ${browser}?`)), limit); })])
      .finally(() => clearTimeout(timer));
  } finally {
    if (child && child.exitCode == null) {
      child.removeAllListeners("exit");
      const gone = new Promise((ok) => child.once("exit", ok));
      child.kill();
      await gone;
    }
    server?.close();
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5 });
  }
  // A frame that never arrived repeats the one before it.
  for (let i = 0; i < count; i++) frames[i] ??= frames[i - 1] ?? frames.find(Boolean);
  return { cols: c, rows: r, frames };
}

/** A shader scene to clip bytes, plus what went into it. */
export async function bakeClip(scene, { colors = 48, gamma = 1, look, name, fps = 12, loop = true, ...opts } = {}) {
  if (look) opts.square = false;
  const v = await bakeFrames(scene, { fps, ...opts });
  return framesClip(v, { colors, gamma, look, name, fps, loop, square: opts.square });
}
