import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { imageSpec, brandSpec } from "../src/raster.js";
import { videoClip, hasFfmpeg } from "../src/video.js";
import { bakeClip, findChromium } from "../src/bake.js";
import { toCast, exportTo } from "../src/export.js";
import { load } from "../src/load.js";
import { pieceModule } from "../src/piecejs.js";
import { svgText, periodOf } from "../src/svg.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MARK = path.join(HERE, "../../extras/examples/mark.svg");
const CLI = path.join(HERE, "../bin/ama-studio.js");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ama-studio-test-"));

test("brand: an SVG with a big viewBox and no size stays under sharp's pixel limit", async () => {
  const big = path.join(tmp, "big.svg");
  fs.writeFileSync(big, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2000 2000"><path d="M1000 400 1600 1600H400Z"/></svg>');
  for (const style of ["blocks", "glyphs"]) {
    const spec = await brandSpec(big, { cols: 40, style });
    assert.ok(spec.cov.join("").replace(/0/g, "").length > 50, `${style} draws the shape`);
  }
  assert.equal((await imageSpec(big, { cols: 40 })).kind, "image");
});

test("brand: an SVG logo becomes a mask with its own colours", async () => {
  const spec = await brandSpec(MARK, { cols: 60, effect: "assemble" });
  assert.equal(spec.kind, "brand");
  assert.equal(spec.cov.length, spec.rows);
  assert.ok(spec.cov.every((r) => r.length === 60 && /^[0-8]+$/.test(r)));
  assert.ok(spec.rows > 10 && spec.rows < 30, `rows ${spec.rows}`);
  const inked = spec.cov.join("").replace(/0/g, "").length;
  assert.ok(inked > 300, `inked cells ${inked}`);
  const keys = Object.keys(spec.palette);
  assert.ok(keys.length >= 3, "gradient, spark and bars");
  assert.ok(Object.values(spec.palette).includes("#ffffff") || Object.values(spec.palette).some((h) => h.startsWith("#f")), "the white spark");
  // padding: the outer ring of cells is empty
  assert.equal(spec.cov[0], "0".repeat(60));
  assert.ok(spec.cov.every((r) => r[0] === "0" && r[59] === "0"));
  const recolored = await brandSpec(MARK, { cols: 60, colors: ["#111111"] });
  assert.equal(recolored.palette[0], "#111111");
});

test("brand: an opaque PNG treats the corner colour as background", async () => {
  const png = path.join(tmp, "logo.png");
  await sharp({ create: { width: 200, height: 100, channels: 3, background: "#ffffff" } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100"><rect x="50" y="25" width="100" height="50" fill="#e11d48"/></svg>') }])
    .png().toFile(png);
  const spec = await brandSpec(png, { cols: 30 });
  assert.deepEqual(Object.values(spec.palette).slice(0, 1), ["#e11d48"]);
  assert.ok(spec.cov.join("").includes("8"));
});

test("convert: a picture becomes an image spec that plays", async () => {
  const png = path.join(tmp, "grad.png");
  const w = 64, h = 32, px = Buffer.alloc(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[i * 3] = (i % w) * 4; px[i * 3 + 1] = Math.floor(i / w) * 8; px[i * 3 + 2] = 128; }
  await sharp(px, { raw: { width: w, height: h, channels: 3 } }).png().toFile(png);
  const spec = await imageSpec(png, { cols: 32, motion: { glint: true } });
  assert.equal(spec.cols, 32);
  assert.equal(spec.rows, 16);
  const src = await load(spec);
  assert.equal(src.meta.cell, "square");
  assert.equal(src.draw(1).text.split("\n").length, 16);
});

test("cast: asciicast v2 with a header and timed frames", async () => {
  const cast = toCast(await load({ kind: "text", text: "OK", effect: "typewriter" }), { seconds: 2 });
  const lines = cast.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].version, 2);
  assert.ok(lines[0].width > 10 && lines[0].height >= 5);
  const times = lines.slice(1).map((e) => e[0]);
  assert.ok(times.every((t, i) => i === 0 || t >= times[i - 1]), "times go up");
  assert.ok(lines.length > 5);
});

test("png export draws through runtime/canvas.js", async () => {
  const file = path.join(tmp, "out.png");
  await exportTo(await load("spinning-torus"), file, { at: 1 });
  const meta = await sharp(file).metadata();
  assert.equal(meta.format, "png");
  assert.ok(meta.width > 300);
  const { channels, data } = await sharp(file).raw().toBuffer({ resolveWithObject: true }).then((r) => ({ channels: r.info.channels, data: r.data }));
  let lit = 0;
  for (let i = 0; i < data.length; i += channels) if (data[i] + data[i + 1] + data[i + 2] > 200) lit++;
  assert.ok(lit > 500, "the torus is drawn");
});

test("video: ffmpeg frames become a clip", { skip: !hasFfmpeg() && "no ffmpeg" }, async () => {
  const mp4 = path.join(tmp, "t.mp4");
  spawnSync("ffmpeg", ["-v", "error", "-y", "-f", "lavfi", "-i", "testsrc2=size=160x90:rate=24", "-t", "1", "-pix_fmt", "yuv420p", mp4]);
  const clip = videoClip(mp4, { cols: 40, fps: 8, seconds: 1 });
  assert.equal(clip.header.cols, 40);
  assert.equal(clip.header.rows, 23);
  assert.equal(clip.frames.length, 8);
  const file = path.join(tmp, "t.amc");
  fs.writeFileSync(file, clip.bytes);
  const src = await load(file);
  assert.deepEqual(src.draw(0.5), clip.frames[4]);
  assert.deepEqual(src.draw(1.0), clip.frames[0], "loops");
  const gif = path.join(tmp, "t.gif");
  await exportTo(src, gif, { seconds: 1 });
  assert.equal((await sharp(gif).metadata()).pages, 8);
});

test("piece module: one self-contained file", async () => {
  const file = path.join(tmp, "hi.piece.js");
  fs.writeFileSync(file, await pieceModule({ kind: "text", text: "HI", effect: "wave" }));
  assert.ok(!/from\s*"/.test(fs.readFileSync(file, "utf8")), "no imports left");
  const mod = await import(file);
  assert.equal(mod.meta.cols, mod.default()(1).text.split("\n")[0].length);
});

test("cli: help, a bad slug suggests names, frames print", () => {
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1", FORCE_COLOR: "" } });
  assert.match(run("--help").stdout, /convert <image\|gif\|video>/);
  const bad = run("play", "matrx-rain");
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Did you mean: matrix-rain/);
  const fr = run("text", "HI", "--effect", "plain", "--frame");
  assert.equal(fr.status, 0);
  assert.match(fr.stdout, /█/);
  assert.match(run("brand", MARK, "--effect", "nope").stderr, /no effect "nope"/);
});

test("svg: a piece, a spec and a still, as animated SVGs", async () => {
  const warn = [];
  const torus = await load("spinning-torus");
  const s = svgText(torus, {}, (w) => warn.push(w));
  assert.match(s, /^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(s.endsWith("</svg>") && s.includes("@keyframes"));
  const logo = await load(JSON.parse(fs.readFileSync(path.join(HERE, "../../extras/examples/mark.json"), "utf8")));
  const l = svgText(logo, {}, (w) => warn.push(w));
  assert.match(l, /forwards/, "an entrance plays once and holds");
  const still = await load({ kind: "text", text: "HI", effect: "plain" });
  assert.ok(svgText(still, {}, (w) => warn.push(w)).startsWith("<svg"));
  assert.match(svgText(logo, { light: true }), /<rect[^>]*fill="#09090b"/, "a coloured piece sits on a dark card on a light page");
});

test("svg: a period is found, or the loop is 4 s with a warning", async () => {
  const p = await load("spinning-torus");
  assert.ok(periodOf(p.create) >= 0);
  const warn = [];
  svgText(await load("matrix-rain"), { fps: 2 }, (w) => warn.push(w));
  assert.ok(warn.some((w) => /no period found/.test(w)));
});

test("svg: --both writes two files and prints the <picture>", () => {
  const out = path.join(tmp, "logo.svg");
  const r = spawnSync(process.execPath, [CLI, "export", path.join(HERE, "../../extras/examples/mark.json"), "-o", out, "--both"], { encoding: "utf8" });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(out) && fs.existsSync(out.replace(".svg", ".dark.svg")));
  assert.match(r.stdout, /<picture>[\s\S]*prefers-color-scheme: dark[\s\S]*logo\.dark\.svg/);
});

test("rest: ascii.rest pieces load, play and export by rest-<name>", async () => {
  const rust = await load("rest-rust");
  assert.equal(rust.kind, "rest");
  const f = rust.draw(1);
  assert.equal(f.text.split("\n").length, rust.meta.rows);
  const cast = toCast(rust, { seconds: 0.5 });
  assert.match(cast.split("\n")[0], /"version":2/);
  await assert.rejects(load("rest-nope"), /Did you mean: rest-/);
});

test("banner: their fonts, as a frame, an SVG and with art beside it", () => {
  const run = (...a) => spawnSync(process.execPath, [CLI, ...a], { encoding: "utf8", env: { ...process.env, NO_COLOR: "1" } });
  const fr = run("banner", "OK", "--font", "slim", "--effect", "still", "--frame");
  assert.equal(fr.status, 0, fr.stderr);
  assert.ok(fr.stdout.trim().split("\n").length >= 3);
  const out = path.join(tmp, "b.svg");
  assert.equal(run("banner", "ACME", "--art", "rest-zig", "--tagline", "hello", "-o", out).status, 0);
  assert.match(fs.readFileSync(out, "utf8"), /hello/);
  assert.match(run("banner", "X", "--font", "nope").stderr, /no font "nope"/);
});

test("brand --style glyphs: characters shaped like the logo's edges, that every effect settles on", async () => {
  const spec = await brandSpec(MARK, { cols: 60, style: "glyphs", effect: "assemble" });
  assert.equal(spec.chars.length, spec.rows);
  assert.ok(spec.chars.every((r) => r.length === spec.cols));
  const ink = spec.chars.join("");
  assert.match(ink, /8/, "solid cells");
  assert.match(ink, /[^8 ]/, "edge glyphs");
  const p = await load(spec);
  const f = p.create()(8);
  assert.equal(f.text.split("\n").length, spec.rows);
  await assert.rejects(brandSpec(MARK, { style: "nope" }), /no style "nope"/);
});

test("bake: a WebGPU shader becomes a clip, on its own clock", { skip: !findChromium() && "no Chromium" }, async () => {
  const clip = await bakeClip({ names: ["Aurora", "FilmGrain"] }, { cols: 32, fps: 6, seconds: 1, colors: 16, name: "aurora" });
  assert.equal(clip.header.cols, 32);
  assert.equal(clip.header.rows, 18, "16:9 in square cells");
  assert.equal(clip.frames.length, 6);
  assert.ok(Object.keys(clip.header.palette).length > 4, "the shader drew colour, not one flat frame");
  assert.ok(new Set(clip.frames.map((f) => JSON.stringify(f))).size > 3, "the frames move");
  const file = path.join(tmp, "aurora.amc");
  fs.writeFileSync(file, clip.bytes);
  const src = await load(file);
  assert.equal(src.kind, "clip");
  await assert.rejects(bakeClip({ names: ["NoSuchShader"] }, { cols: 8, seconds: 0.2 }), /could not bundle the scene/);
});
