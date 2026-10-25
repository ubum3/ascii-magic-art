import test from "node:test";
import assert from "node:assert/strict";
import { fromRest, toRest, fold, restSlugs, restPiece, restModule, isRestSlug, svg, banner, drawing } from "../src/index.js";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";

const TIMES = [0, 0.5, 1.5, 3.25];

test("every ascii.rest piece is here, as rest-<name>", () => {
  assert.equal(restSlugs.length, 240);
  assert.ok(isRestSlug("rest-rust") && !isRestSlug("rust") && !isRestSlug("rest-nope"));
});

test("a coloured piece: keys where there is ink, a space where there is none", async () => {
  const p = await restPiece("rest-rust");
  assert.equal(p.meta.slug, "rest-rust");
  assert.deepEqual(p.meta.tags, ["ascii.rest", "logos"]);
  const draw = p.default();
  for (const t of TIMES) {
    const { text, color } = draw(t);
    const T = text.replace(/\n/g, ""), C = color.replace(/\n/g, "");
    assert.equal([...T].length, [...C].length);
    [...T].forEach((ch, i) => assert.equal(C[i] === " ", ch === " ", `cell ${i} at t=${t}`));
    for (const k of new Set(C.replace(/ /g, ""))) assert.ok(p.meta.palette[k], `key ${k}`);
  }
});

test("deterministic: two players draw the same frames", async () => {
  for (const name of ["rest-night-coast", "rest-donut", "rest-ubuntu", "rest-matrix-rain"]) {
    const p = await restPiece(name), a = p.default(), b = p.default();
    for (const t of TIMES) assert.deepEqual(a(t), b(t), `${name} t=${t}`);
  }
});

test("palettes fold to at most 59 keys, keeping X, Y and Z free", () => {
  const many = Array.from({ length: 64 }, (_, i) => "#" + (i * 4).toString(16).padStart(2, "0").repeat(3));
  const f = fold(many, 59);
  assert.equal(f.palette.length, 59);
  assert.ok(f.map.every((k) => k >= 0 && k < 59));
  const p = fromRest({ meta: { name: "many", category: "effects", note: "", cols: 2, rows: 1, fps: 10, palette: many }, default: () => (t, e) => { e.color[0] = 63; e.color[1] = 0; return "ab"; } });
  assert.equal(Object.keys(p.meta.palette).length, 59);
  assert.ok(!/[XYZ]/.test(Object.keys(p.meta.palette).join("")));
  assert.equal(p.default()(0).color.length, 2);
});

test("stills and square cells carry over", async () => {
  const m = { name: "dot", category: "shapes", note: "", cols: 3, rows: 1, fps: 0, cell: 1 };
  const p = fromRest({ meta: m, default: () => () => " o " });
  assert.equal(p.meta.still, true);
  assert.equal(p.meta.cell, "square");
  assert.equal(p.default()(0), " o ");
});

test("ours to theirs and back draws the same frame", () => {
  const theirs = toRest(torus);
  assert.equal(theirs.meta.cell, 2);
  const back = fromRest(theirs, { slug: "torus-again" }).default(), ours = torus.default();
  for (const t of TIMES) {
    const a = ours(t), b = back(t);
    const at = typeof a === "string" ? a : a.text;
    assert.equal(typeof b === "string" ? b : b.text, at);
    if (typeof a === "object") {
      // Same colours cell by cell (keys may be renumbered).
      const pa = torus.meta.palette, pb = fromRest(theirs).meta.palette;
      const ca = a.color.replace(/\n/g, ""), cb = b.color.replace(/\n/g, "");
      [...ca].forEach((k, i) => assert.equal(k === " " ? "ink" : pa[k], cb[i] === " " ? "ink" : pb[cb[i]] === "#e4e4e7" ? "ink" : pb[cb[i]]));
    }
  }
});

test("theirs svg() takes ours", () => {
  const out = svg(toRest(torus, { seconds: 2 }), { dark: true, fps: 6 });
  assert.match(out, /^<svg[^>]*xmlns="http:\/\/www.w3.org\/2000\/svg"/);
  assert.ok(out.endsWith("</svg>"));
  assert.ok(out.length < 1_000_000);
});

test("svg() of twenty of their pieces is well formed", async () => {
  const { restNames } = await import("../src/index.js");
  for (const name of restNames.filter((_, i) => i % 12 === 0)) {
    const out = svg(await restModule(name), { dark: true, fps: 4, seconds: 1 });
    assert.match(out, /^<svg/);
    assert.ok(out.endsWith("</svg>"), name);
    assert.equal((out.match(/<g\b/g) || []).length >= 1, true, name);
  }
});

test("banner() and drawing() are re-exported", () => {
  const b = banner("hi", { font: "slim" });
  assert.ok(b.meta.cols > 4 && typeof b.default === "function");
  const px = new Uint8Array(32 * 32 * 4);
  for (let y = 8; y < 24; y++) for (let x = 8; x < 24; x++) px.set([255, 80, 0, 255], (y * 32 + x) * 4);
  const d = drawing(px, 32, 32, { style: "logo", width: 16, color: true });
  assert.ok(d.cols > 0 && d.art.length === d.rows);
});
