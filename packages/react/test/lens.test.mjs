/*
 * The Time Lens against the built dist/ (run `npm run build` first): at rest it is
 * the plain piece, cells come from their band, data specs are refused.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { AsciiTimeLens, timeLens, createLens, lensFrame } from "../dist/lens.js";
import { fromSpec } from "ascii-magic-art-extras";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";

test("at rest, the lens draws the plain piece exactly", () => {
  const plain = torus.default(), lensed = timeLens(torus).default();
  for (const t of [0, 0.4, 1.3, 2.9]) assert.deepEqual(lensed(t), plain(t), `t=${t}`);
});

test("lensFrame takes each cell from its band, colours too", () => {
  const a = { text: "aaa\naaa", color: "000\n000" }, b = { text: "bbb\nbbb", color: "111\n111" };
  const f = lensFrame([a, b], (x, y) => (x === 1 && y === 0) || (x === 2 && y === 1) ? 1 : 0, 3, 2);
  assert.deepEqual(f, { text: "aba\naab", color: "010\n001" });
  assert.equal(lensFrame([a, b], () => 0, 3, 2), a, "all band 0 is frame 0 itself");
  assert.equal(lensFrame(["xy", "zw"], (x) => x, 2, 1), "xw", "plain frames stay plain");
});

test("the field follows the pointer, bands rise under it and settle when it leaves", () => {
  const lens = createLens({ bands: 6 });
  lens.point(0.1, 0.1);
  for (let i = 0; i < 60; i++) lens.step(1 / 30);
  const near = lens.band(1, 1, 40, 20), far = lens.band(38, 18, 40, 20);
  assert.ok(near >= 4, `band ${near} under the pointer`);
  assert.equal(far, 0, "far away it is the plain piece");
  lens.leave();
  for (let i = 0; i < 300; i++) lens.step(1 / 30);
  assert.equal(lens.band(1, 1, 40, 20), 0);
  assert.ok(lens.field.every((v) => v === 0), "settled to rest");
});

test("under the pointer, cells come from a later time", () => {
  const lens = createLens();
  const piece = timeLens(torus, { delta: 0.5 }, lens), draw = piece.default();
  lens.point(0.5, 0.5);
  let f;
  for (let i = 0; i <= 45; i++) f = draw(i / 30);
  const plain = torus.default()(1.5), later = torus.default()(1.5 + 5 * 0.5);
  const text = (fr) => (typeof fr === "string" ? fr : fr.text);
  assert.notEqual(text(f), text(plain));
  const rows = text(f).split("\n"), cy = Math.floor(rows.length / 2), cx = Math.floor(torus.meta.cols / 2);
  const lr = text(later).split("\n");
  // the middle row around the centre matches the latest band
  assert.equal([...rows[cy]].slice(cx - 2, cx + 3).join(""), [...lr[cy]].slice(cx - 2, cx + 3).join(""));
});

test("data specs are refused; the component renders its first frame on the server", () => {
  assert.throws(() => timeLens(fromSpec({ kind: "progress", cols: 10 })), /draws state/);
  const html = renderToString(h(AsciiTimeLens, { piece: torus, t0: 1 }));
  assert.match(html, /aria-label="Spinning Torus, animated ASCII art"/);
  assert.match(html, /touch-action:none/);
});
