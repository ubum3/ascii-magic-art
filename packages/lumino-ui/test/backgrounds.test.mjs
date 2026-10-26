/*
 * The shared background parts and the registry, against dist/ (build first). Each
 * builder's backgrounds are also covered here: every registry entry must load and
 * render its fallback on the server.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { LUMINO_BACKGROUNDS, findBackground, chooseBackground, LuminoRandomBackground, BackgroundFrame, BRAND_FALLBACK, paletteTexture, rgb } from "lumino-ui/backgrounds";
import { BRANDMARK, LUMINO_COLORS, LUMINO_GRADIENT, LUMINO_PALETTE, Brandmark } from "lumino-ui/brand";

test("the brand: seven stops, the ground, the gradient, three paths", () => {
  assert.equal(LUMINO_PALETTE.length, 7);
  assert.equal(LUMINO_COLORS.ground, "#111013");
  assert.match(LUMINO_GRADIENT, /^linear-gradient\(139\.22deg, #F8AD90 4\.94%, .*#A4A5D1 88\.05%\)$/);
  assert.equal(BRANDMARK.paths.length, 3);
  assert.deepEqual(rgb("#ff8000"), [1, 128 / 255, 0]);
  assert.equal(typeof paletteTexture, "function");
});

test("Brandmark renders the three paths, aria-hidden, tight or square", () => {
  const html = renderToString(h(Brandmark, { tight: true, fill: "#fff" }));
  assert.equal(html.match(/<path /g).length, 3);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /viewBox="359\.72 444\.98 1280\.67 1111\.36"/);
  assert.match(renderToString(h(Brandmark)), /viewBox="0 0 2000 2000"/);
});

test("BackgroundFrame shows the fallback, hides the art until ready, dims and holds children", () => {
  const html = renderToString(h(BackgroundFrame, { art: h("canvas"), ready: false, dim: 0.5, className: "x" }, h("h1", null, "Hi")));
  assert.match(html, /class="x"/);
  assert.match(html, /data-lumino-bg=""/);
  assert.ok(html.includes(BRAND_FALLBACK.slice(0, 30)), "the brand fallback is the background");
  assert.match(html, /opacity:0/);
  assert.match(html, /<h1>Hi<\/h1>/);
  assert.match(html, /#11101380/, "dim 0.5 is alpha 80");
  assert.doesNotMatch(renderToString(h(BackgroundFrame, { art: null, ready: true })), /radial-gradient\(ellipse/, "no dim layer at 0");
});

test("registry: unique ids that match their folders and entries", () => {
  const ids = LUMINO_BACKGROUNDS.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const b of LUMINO_BACKGROUNDS) {
    assert.match(b.id, /^[a-z0-9-]+$/, b.id);
    assert.ok(fs.existsSync(new URL(`../src/components/${b.id}/index.ts`, import.meta.url)), `${b.id}: no src/components/${b.id}/index.ts`);
    assert.ok(b.name && b.description && b.author && b.tags.length, `${b.id}: name, description, author and tags`);
    assert.equal(findBackground(b.id), b);
  }
});

test("every background loads and renders its fallback and children on the server, with no canvas work", async () => {
  for (const b of LUMINO_BACKGROUNDS) {
    const C = await b.load();
    assert.equal(typeof C, "function", b.id);
    const html = renderToString(h(C, { dim: 0.3, style: { height: 500 } }, h("h1", null, "Hello")));
    assert.match(html, /data-lumino-bg=""/, `${b.id}: renders inside BackgroundFrame`);
    assert.match(html, /<h1>Hello<\/h1>/, `${b.id}: children`);
    assert.match(html, /height:500px/, `${b.id}: passes style through`);
  }
});

test("every background file starts with \"use client\"", () => {
  for (const b of LUMINO_BACKGROUNDS) {
    const dir = new URL(`../dist/components/${b.id}/`, import.meta.url);
    const main = fs.readdirSync(dir).filter((f) => /^[A-Z].*\.js$/.test(f));
    assert.ok(main.length, `${b.id}: a <Name>.js component file`);
    for (const f of main) assert.match(fs.readFileSync(new URL(f, dir), "utf8"), /^"use client";/, `${b.id}/${f}`);
  }
});

test("the root and pieces entries load no background code", () => {
  for (const f of ["index.js", "pieces.js"]) assert.doesNotMatch(fs.readFileSync(new URL(`../dist/${f}`, import.meta.url), "utf8"), /backgrounds|webgl/i, f);
});

test("chooseBackground: honours a pin, never repeats the last when it can, and covers the pool", () => {
  const pool = ["a", "b", "c"].map((id) => ({ id }));
  assert.equal(chooseBackground(pool, null, "b").id, "b");
  assert.equal(chooseBackground([{ id: "a" }], "a").id, "a", "one choice: repeat it");
  const seen = new Set();
  for (let i = 0; i < 300; i++) {
    const p = chooseBackground(pool, "a");
    assert.notEqual(p.id, "a");
    seen.add(p.id);
  }
  assert.deepEqual([...seen].sort(), ["b", "c"]);
  assert.equal(chooseBackground([], null), undefined);
});

test("LuminoRandomBackground renders the fallback and children on the server (it picks after mount)", () => {
  const html = renderToString(h(LuminoRandomBackground, { dim: 0.2 }, h("form", null, "card")));
  assert.match(html, /data-lumino-bg=""/);
  assert.match(html, /<form>card<\/form>/);
  assert.doesNotMatch(html, /<canvas/);
});
