/*
 * Tests against the built dist/ (run `npm run build` first): the components
 * render on the server and the baked clips decode.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { loadClip } from "ascii-magic-art-react/extras";
import { NebulaSky } from "ascii/nebula-sky";
import { CursorField } from "ascii/cursor-field";
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

// The shader components: WebGPU scenes as ASCII, with baked clips for browsers without it.

test("there is no root entry: every component, and so WebGPU code, loads only from its own entry", () => {
  const { exports } = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal("." in exports, false);
  assert.equal(fs.existsSync(new URL("../dist/index.js", import.meta.url)), false);
});

test("shader components render on the server: their box, their children, no GPU", () => {
  assert.equal(typeof navigator === "undefined" || !navigator.gpu, true);
  for (const [C, bg] of [[NebulaSky, "#04060c"], [CursorField, "#05060a"]]) {
    const html = renderToString(h(C, { style: { height: "50vh" } }, h("h1", null, "Hello")));
    assert.match(html, /<h1>Hello<\/h1>/, C.name);
    assert.match(html, new RegExp(`background:${bg}`), C.name);
    assert.match(html, /container-type:size/, C.name);
  }
  const html = renderToString(h(AsciiTransition, { show: 1 }, h("p", null, "Slide")));
  assert.match(html, /<p>Slide<\/p>/);
});

test("every baked clip decodes to a 6 s loop that fills the grid", async () => {
  const clips = ["nebula-sky/clip.js", "cursor-field/clip-flow.js", "cursor-field/clip-filings.js", "cursor-field/clip-bloom.js"];
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

test("DarkVeil renders an empty, sized box on the server", () => {
  const html = renderToString(h(DarkVeil, { className: "hero", style: { height: 600 }, "data-x": "1" }));
  assert.match(html, /class="dark-veil-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.match(html, /data-x="1"/);
  assert.match(html, /<canvas class="dark-veil-canvas"[^>]*aria-hidden="true"/);
});

test("GhostFibers renders an empty, sized box on the server", () => {
  const html = renderToString(h(GhostFibers, { className: "hero", style: { height: 600 }, fiberStyle: "lines" }));
  assert.match(html, /class="ghost-fibers-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.match(html, /<canvas class="ghost-fibers-canvas"[^>]*aria-hidden="true"/);
});

test("Threads renders an empty, sized box on the server", () => {
  const html = renderToString(h(Threads, { className: "hero", style: { height: 600 }, color: "#38bdf8" }));
  assert.match(html, /class="threads-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px/);
  assert.doesNotMatch(html, /color:/);
  assert.match(html, /<canvas class="threads-canvas"[^>]*aria-hidden="true"/);
});

test("PixelSnow renders an empty, sized box on the server", () => {
  const html = renderToString(h(PixelSnow, { className: "hero", style: { height: 600 }, color: "#bae6fd", variant: "round" }));
  assert.match(html, /class="pixel-snow-container hero"/);
  assert.match(html, /position:relative;width:100%;height:600px;overflow:hidden/);
  assert.doesNotMatch(html, /color:|variant=/);
  assert.match(html, /<canvas class="pixel-snow-canvas"[^>]*aria-hidden="true"/);
});
