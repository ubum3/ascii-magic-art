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
import * as orbit from "lumino-ui/edge-orbit";
import * as deep from "lumino-ui/lumino-donut";
import * as pieces from "lumino-ui/pieces";
import * as space from "lumino-ui/lumino-space";
import { frameHTML } from "ascii-magic-art-react/kit";
import { loadClip } from "ascii-magic-art-react/extras";
import { LuminoHolo } from "lumino-ui/lumino-holo";

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

test("each component has its own entry, and the pieces entry has no React", () => {
  assert.equal(deep.LuminoDonut, LuminoDonut);
  assert.equal(deep.luminoDonut, luminoDonut);
  assert.equal(pieces.luminoDonut, luminoDonut);
  assert.equal("LuminoDonut" in pieces, false);
  assert.equal(space.LuminoSpace, LuminoSpace);
  assert.equal(pieces.luminoSpace, luminoSpace);
});

test('the component files start with "use client"', () => {
  for (const f of ["lumino-donut/LuminoDonut.js", "lumino-space/LuminoSpace.js", "edge-orbit/EdgeOrbit.js", "lumino-holo/LuminoHolo.js"]) {
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

// LuminoHolo: a WebGPU scene as ASCII, with a baked clip for browsers without it.

test("the root entry leaves LuminoHolo (and shaders) out", async () => {
  const root = await import("../dist/index.js");
  assert.equal("LuminoHolo" in root, false);
  const src = fs.readFileSync(new URL("../dist/index.js", import.meta.url), "utf8");
  assert.doesNotMatch(src, /shader|holo/);
});

test("LuminoHolo renders on the server: its box, its children, no GPU", () => {
  assert.equal(typeof navigator === "undefined" || !navigator.gpu, true);
  const html = renderToString(h(LuminoHolo, { style: { height: "50vh" } }, h("h1", null, "Hello")));
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.match(html, /background:#04060c/);
  assert.match(html, /container-type:size/);
});

test("LuminoHolo's baked clip decodes to a 6 s loop that fills the grid", async () => {
  const { CLIP } = await import("../dist/components/lumino-holo/clip.js");
  const piece = await loadClip(Buffer.from(CLIP, "base64"));
  const { cols, rows, fps } = piece.meta;
  assert.deepEqual([cols, rows], [80, 45]);
  const draw = piece.default(), a = draw(0), b = draw(1.5);
  assert.equal(a.text.split("\n").length, rows);
  assert.notEqual(a.text, b.text, "it moves");
  assert.ok(CLIP.length < 400_000, `${CLIP.length} bytes`);
  assert.ok(fps > 0);
});
