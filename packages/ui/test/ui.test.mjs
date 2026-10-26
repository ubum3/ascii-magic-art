/*
 * Tests against the built dist/ (run `npm run build` first): the pieces draw
 * full frames that stay in bounds and loop, and the components render on the server.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { LuminoDonut, luminoDonut, LUMINO_DONUT_PERIOD, LuminoSpace, luminoSpace, LUMINO_SPACE_PERIOD, EdgeOrbit, edgeOrbit, EDGE_ORBIT_PERIOD } from "../dist/index.js";
import * as orbit from "ascii/edge-orbit";
import * as deep from "ascii/lumino-donut";
import * as pieces from "ascii/pieces";
import * as space from "ascii/lumino-space";
import { frameHTML } from "ascii-magic-art-react/kit";
import { loadClip } from "ascii-magic-art-react/extras";
import { NebulaSky } from "ascii/nebula-sky";
import { CursorField } from "ascii/cursor-field";
import { LuminoHolo } from "ascii/lumino-holo";
import { AsciiTransition } from "ascii/ascii-transition";
import { AsciiOverlay, splitStage } from "ascii/ascii-overlay";
import { PlasmaBackground } from "ascii/plasma-background";
import { SilkBackground } from "ascii/silk-background";
import { MeshBackground } from "ascii/mesh-background";
import { ChromaBackground } from "ascii/chroma-background";
import { DarkVeil } from "ascii/dark-veil";
import { GhostFibers } from "ascii/ghost-fibers";
import { Threads } from "ascii/threads";
import { PixelSnow } from "ascii/pixel-snow";

const cells = (f) => f.text.split("\n");

test("lumino-donut draws cols x rows frames with colour", () => {
  const { cols, rows } = luminoDonut.meta, draw = luminoDonut.default();
  const f = draw(1);
  assert.equal(cells(f).length, rows);
  assert.ok(cells(f).every((r) => [...r].length === cols));
  assert.ok(f.color.split("\n").some((r) => /[89a-v]/.test(r)), "rainbow edges use palette keys 8-31");
  assert.equal(Object.keys(luminoDonut.meta.palette).length, 32);
});

test("lumino-donut stays inside the frame for a whole loop", () => {
  const draw = luminoDonut.default();
  for (let t = 0; t < LUMINO_DONUT_PERIOD; t += 1 / 15) {
    const r = cells(draw(t));
    assert.equal(r[0].trim() + r.at(-1).trim(), "", `t=${t.toFixed(2)}: touches top or bottom`);
    assert.ok(r.every((row) => row[0] === " " && row.at(-1) === " "), `t=${t.toFixed(2)}: touches a side`);
  }
});

test("lumino-donut loops: the frame at one period is the first frame", () => {
  const draw = luminoDonut.default(), a = draw(0).text, b = draw(LUMINO_DONUT_PERIOD).text;
  const diff = [...a].filter((c, i) => c !== b[i]).length;
  assert.ok(diff <= 4, `${diff} cells differ`); // float rounding may move a cell or two
});

test("draw(t) is pure in t, so server and browser agree", () => {
  const a = luminoDonut.default(), b = luminoDonut.default();
  a(3.3);
  assert.deepEqual(a(1.2), b(1.2));
});

test("LuminoDonut puts its first frame in the server HTML", () => {
  const html = renderToString(h(LuminoDonut, { bg: "#0b0b10" }));
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="The Lumino brandmark, spinning"/);
  assert.match(html, /<pre[^>]*>[\s\S]*[@$#*][\s\S]*<\/pre>/);
});

test('the component files start with "use client"', () => {
  for (const f of ["lumino-donut/LuminoDonut.js", "lumino-space/LuminoSpace.js", "edge-orbit/EdgeOrbit.js", "nebula-sky/NebulaSky.js",
    "cursor-field/CursorField.js", "lumino-holo/LuminoHolo.js", "ascii-transition/AsciiTransition.js", "../shader/ShaderStage.js",
    "ascii-overlay/AsciiOverlay.js", "plasma-background/PlasmaBackground.js", "silk-background/SilkBackground.js",
    "mesh-background/MeshBackground.js", "chroma-background/ChromaBackground.js"]) {
    const src = fs.readFileSync(new URL(`../dist/components/${f}`, import.meta.url), "utf8");
    assert.match(src, /^"use client";/, f);
  }
});

test("each component has its own entry, and the pieces entry has no React", () => {
  assert.equal(deep.LuminoDonut, LuminoDonut);
  assert.equal(deep.luminoDonut, luminoDonut);
  assert.equal(pieces.luminoDonut, luminoDonut);
  assert.equal("LuminoDonut" in pieces, false);
  assert.equal(space.LuminoSpace, LuminoSpace);
  assert.equal(pieces.luminoSpace, luminoSpace);
});

test("lumino-space draws full frames, with brandmark stars, and is pure in t", () => {
  const { cols, rows } = luminoSpace.meta, a = luminoSpace.default(), b = luminoSpace.default();
  const f = a(9.5);
  assert.equal(cells(f).length, rows);
  assert.ok(cells(f).every((r) => [...r].length === cols));
  assert.ok(/[#$@*!]/.test(f.text), "brandmarks are drawn");
  a(50);
  assert.deepEqual(a(9.5), b(9.5));
});

test("lumino-space loops: the frame at one period is the first frame", () => {
  const draw = luminoSpace.default();
  for (const t of [0, 13.7]) {
    const x = draw(t).text, y = draw(t + LUMINO_SPACE_PERIOD).text;
    const diff = [...x].filter((c, i) => c !== y[i]).length;
    assert.ok(diff <= 8, `t=${t}: ${diff} cells differ`);
  }
});

test("every lumino-space frame fits the server prerender limit", () => {
  const MAX_PRERENDER = 48_000; // packages/react/src/core/prerender.ts: bigger first frames are left to the client
  const draw = luminoSpace.default();
  for (let t = 0; t < LUMINO_SPACE_PERIOD; t += 0.5) {
    const n = frameHTML(draw(t), luminoSpace.meta.palette).length;
    assert.ok(n <= MAX_PRERENDER, `t=${t}: ${n} bytes of HTML`);
  }
});

test("lumino-space is cheap enough for a background", () => {
  const draw = luminoSpace.default(), t0 = performance.now();
  for (let i = 0; i < 120; i++) draw(i / 24);
  const ms = (performance.now() - t0) / 120;
  assert.ok(ms < 8, `${ms.toFixed(2)} ms a frame`);
});

test("LuminoSpace fills its container behind its children, first frame on the server", () => {
  const html = renderToString(h(LuminoSpace, { dim: 0.2, style: { height: "100vh" } }, h("h1", null, "Hello")));
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /background:#05060f/);
  assert.match(html, /<pre[^>]*>[\s\S]*[#$@*!][\s\S]*<\/pre>/);
});

test("edge-orbit draws full square-cell frames with the brand's orange, pure in t", () => {
  const { cols, rows, cell } = edgeOrbit.meta, a = edgeOrbit.default(), b = edgeOrbit.default();
  assert.equal(cell, "square");
  const f = a(30);
  assert.equal(cells(f).length, rows);
  assert.ok(cells(f).every((r) => [...r].length === cols));
  assert.ok(/[·•●]/.test(f.text), "halftone dots are drawn");
  assert.equal(edgeOrbit.meta.palette.h, "#f38020"); // key h is index 17, the requests' orange
  a(500);
  assert.deepEqual(a(30), b(30));
  assert.equal(orbit.EdgeOrbit, EdgeOrbit);
  assert.equal(pieces.edgeOrbit, edgeOrbit);
});

test("edge-orbit loops: the frame at one period is the first frame", () => {
  const draw = edgeOrbit.default();
  for (const t of [0, 13.7]) {
    const x = draw(t).text, y = draw(t + EDGE_ORBIT_PERIOD).text;
    const diff = [...x].filter((c, i) => c !== y[i]).length;
    assert.ok(diff <= 8, `t=${t}: ${diff} cells differ`);
  }
});

test("edge-orbit is cheap enough for a background", () => {
  const draw = edgeOrbit.default(), t0 = performance.now();
  for (let i = 0; i < 60; i++) draw(i / 15);
  const ms = (performance.now() - t0) / 60;
  assert.ok(ms < 12, `${ms.toFixed(2)} ms a frame`);
});

test("EdgeOrbit fills its container behind its children (square cells: no server frame)", () => {
  const html = renderToString(h(EdgeOrbit, { style: { height: "100vh" } }, h("h1", null, "Hello")));
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /background:#04060c/);
});

test("edge-orbit has a white brandmark star in the top right", () => {
  const { cols, palette } = edgeOrbit.meta, f = edgeOrbit.default()(5);
  const T = f.text.split("\n"), C = f.color.split("\n");
  let white = 0;
  for (let r = 0; r < 35; r++) for (let x = Math.floor(cols * 0.6); x < cols; x++) if (T[r][x] === "●" && /^#(ffffff|d6d6de)$/.test(palette[C[r][x]])) white++;
  assert.ok(white > 40, `${white} big white dots`);
});

// The shader components: WebGPU scenes as ASCII, with baked clips for browsers without it.

test("the root entry leaves the shader components (and shaders) out", async () => {
  const root = await import("../dist/index.js");
  for (const name of ["NebulaSky", "CursorField", "LuminoHolo", "AsciiTransition", "AsciiOverlay", "PlasmaBackground", "SilkBackground", "MeshBackground", "ChromaBackground"]) assert.equal(name in root, false, name);
  const src = fs.readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /shader|nebula|cursor-field|holo|transition|overlay|background/);
});

test("shader components render on the server: their box, their children, no GPU", () => {
  assert.equal(typeof navigator === "undefined" || !navigator.gpu, true);
  for (const [C, bg] of [[NebulaSky, "#04060c"], [CursorField, "#05060a"], [LuminoHolo, "#04060c"]]) {
    const html = renderToString(h(C, { style: { height: "50vh" } }, h("h1", null, "Hello")));
    assert.match(html, /<h1>Hello<\/h1>/, C.name);
    assert.match(html, new RegExp(`background:${bg}`), C.name);
    assert.match(html, /container-type:size/, C.name);
  }
  const html = renderToString(h(AsciiTransition, { show: 1 }, h("p", null, "Slide")));
  assert.match(html, /<p>Slide<\/p>/);
});

test("every baked clip decodes to a 6 s loop that fills the grid", async () => {
  const clips = ["nebula-sky/clip.js", "cursor-field/clip-flow.js", "cursor-field/clip-filings.js", "cursor-field/clip-bloom.js", "lumino-holo/clip.js"];
  for (const f of clips) {
    const { CLIP } = await import(`../dist/components/${f}`);
    const piece = await loadClip(Buffer.from(CLIP, "base64"));
    const { cols, rows, fps } = piece.meta;
    assert.deepEqual([cols, rows], [80, 45], f);
    const draw = piece.default(), a = draw(0), b = draw(1.5);
    assert.equal(a.text.split("\n").length, rows, f);
    assert.notEqual(a.text, b.text, `${f}: it moves`);
    assert.ok(CLIP.length < 400_000, `${f}: ${CLIP.length} bytes`);
    assert.ok(fps > 0, f);
  }
});

// The gradient backgrounds: full-resolution shaders with optional GPU ASCII on top.

test("gradient backgrounds render on the server with a CSS gradient for no-WebGPU, and their children", () => {
  const cases = [
    [PlasmaBackground, {}, /radial-gradient\(circle at 30% 40%, #ff2bd6, #0a0420 70%\)/],
    [SilkBackground, { colorB: "#123456" }, /linear-gradient\(135deg, #0a0015, #123456, #ff4d6a, #ff6b35\)/],
    [MeshBackground, {}, /linear-gradient\(160deg, #1a0533, #6d2fd1, #e04b9e, #ff8c42, #ffdf8e\)/],
    [MeshBackground, { colors: ["#000000", "#ffffff"] }, /linear-gradient\(160deg, #000000, #ffffff\)/],
    [MeshBackground, { colorA: "#111111", colorB: "#222222" }, /linear-gradient\(160deg, #111111, #222222\)/],
    [ChromaBackground, {}, /linear-gradient\(160deg, #0b0b1a, #2a1a5e\)/],
  ];
  for (const [C, props, fallback] of cases) {
    for (const ascii of ["off", "overlay", "full"]) {
      const html = renderToString(h(C, { ...props, ascii, style: { height: "50vh" } }, h("h1", null, "Hello")));
      assert.match(html, /<h1>Hello<\/h1>/, `${C.name} ${ascii}`);
      assert.match(html, fallback, `${C.name} ${JSON.stringify(props)}`);
    }
  }
  const html = renderToString(h(AsciiOverlay, { layers: null, fallback: "#abcdef" }, h("p", null, "x")));
  assert.match(html, /background:#abcdef/);
});

test("splitStage sends stage props to the stage and the rest to the layer", () => {
  const [stage, layer] = splitStage({ ascii: "full", cellSize: 20, dim: 0.2, children: "x", colorA: "#fff", speed: 2 });
  assert.deepEqual(stage, { ascii: "full", cellSize: 20, dim: 0.2, children: "x" });
  assert.deepEqual(layer, { colorA: "#fff", speed: 2 });
});

// React Bits components: ported as they are, on their own entries.

test("DarkVeil renders an empty, sized box on the server and stays off the root entry", async () => {
  const html = renderToString(h(DarkVeil, { className: "hero", style: { height: 600 }, "data-x": "1" }));
  assert.match(html, /class="dark-veil-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.match(html, /data-x="1"/);
  assert.match(html, /<canvas class="dark-veil-canvas"[^>]*aria-hidden="true"/);
  assert.equal("DarkVeil" in await import("../dist/index.js"), false);
});

test("GhostFibers renders an empty, sized box on the server and stays off the root entry", async () => {
  const html = renderToString(h(GhostFibers, { className: "hero", style: { height: 600 }, fiberStyle: "lines" }));
  assert.match(html, /class="ghost-fibers-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.match(html, /<canvas class="ghost-fibers-canvas"[^>]*aria-hidden="true"/);
  assert.equal("GhostFibers" in await import("../dist/index.js"), false);
});

test("Threads renders an empty, sized box on the server and stays off the root entry", async () => {
  const html = renderToString(h(Threads, { className: "hero", style: { height: 600 }, color: "#38bdf8" }));
  assert.match(html, /class="threads-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px/);
  assert.doesNotMatch(html, /color:/);
  assert.match(html, /<canvas class="threads-canvas"[^>]*aria-hidden="true"/);
  assert.equal("Threads" in await import("../dist/index.js"), false);
});

test("PixelSnow renders an empty, sized box on the server and stays off the root entry", async () => {
  const html = renderToString(h(PixelSnow, { className: "hero", style: { height: 600 }, color: "#bae6fd", variant: "round" }));
  assert.match(html, /class="pixel-snow-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.doesNotMatch(html, /color:|variant=/);
  assert.match(html, /<canvas class="pixel-snow-canvas"[^>]*aria-hidden="true"/);
  assert.equal("PixelSnow" in await import("../dist/index.js"), false);
});
