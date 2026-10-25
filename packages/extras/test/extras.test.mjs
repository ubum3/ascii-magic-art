import { test } from "node:test";
import assert from "node:assert/strict";
import { fromSpec, make, cellsFromPixels, buildPalette, cellsFrame, encodeClip, decodeClip, clipPiece, layout } from "../src/index.js";
import { fixtures, testPixels, TIMES } from "./fixtures.js";
import zlib from "node:zlib";

const text = (f) => (typeof f === "string" ? f : f.text);
const size = (f) => { const rows = text(f).split("\n"); return [Math.max(...rows.map((r) => [...r].length)), rows.length, rows.every((r) => [...r].length === [...rows[0]].length)]; };

// Still by design: no motion, a plain effect, an idle that holds.
const STILL = ["image-still", "text-plain", "brand-idle-still"];

for (const [name, spec, state] of fixtures()) {
  test(`${name}: exact size, animates, deterministic, fast`, () => {
    const piece = fromSpec(spec);
    const { cols, rows, palette } = piece.meta;
    const a = piece.default(), b = piece.default();
    const seen = new Set();
    let worst = 0;
    for (let i = 0; i < 90; i++) {
      const t = i / 15, t0 = performance.now();
      const f = a(t, state);
      worst = Math.max(worst, performance.now() - t0);
      const [w, h, even] = size(f);
      assert.equal(w, cols, `${name} width at t=${t}`);
      assert.equal(h, rows, `${name} height at t=${t}`);
      assert.ok(even, `${name} ragged at t=${t}`);
      if (typeof f !== "string") for (const k of new Set(f.color.replace(/[\n ]/g, ""))) assert.ok(palette[k], `${name}: key ${k} not in palette`);
      seen.add(typeof f === "string" ? f : f.text + f.color);
    }
    assert.ok(STILL.includes(name) || seen.size > 3, `${name} animates (${seen.size} distinct frames)`);
    let fa, fb;
    for (const t of TIMES) { fa = a(t, state); fb = b(t, state); }
    assert.deepEqual(fa, fb, "same calls, same frames");
    assert.ok(worst < 12, `${name}: ${worst.toFixed(1)} ms for a frame`);
  });
}

test("unknown kind names the kinds", () => {
  assert.throws(() => make({ kind: "nope" }), /unknown kind "nope": one of image, brand/);
});

test("looks apply to specs", () => {
  const p = fromSpec({ kind: "text", text: "HI", effect: "plain" }, { look: "dots" });
  assert.match(text(p.default()(2)), /[·•●]/);
});

test("cellsFromPixels: one palette colour per hue, levels follow brightness", () => {
  const px = new Uint8Array(8 * 2 * 4);
  for (let x = 0; x < 8; x++) {
    const v = Math.round(((x + 1) / 8) * 255);
    px.set([v, 0, 0, 255], x * 4);          // red, darker to the left
    px.set([0, 0, v, 255], (x + 8) * 4);    // blue
  }
  const c = cellsFromPixels(px, 8, 2, { colors: 2 });
  assert.equal(Object.keys(c.palette).length, 2);
  assert.deepEqual(c.level, ["01234567", "01234567"]);
  assert.equal(new Set(c.color[0]).size, 1);
  assert.notEqual(c.color[0][0], c.color[1][0]);
  assert.equal(c.palette[c.color[0][0]], "#ff0000");
  const black = cellsFromPixels(new Uint8Array([0, 0, 0, 255, 255, 255, 255, 0]), 2, 1);
  assert.deepEqual(black.color, ["  "], "black and transparent pixels are empty");
});

test("buildPalette caps colours at 59 and handles empty pictures", () => {
  assert.ok(buildPalette([testPixels(64, 64)], 200).length <= 59);
  assert.deepEqual(buildPalette([new Uint8Array(16)]), ["#ffffff"]);
  const c = cellsFromPixels(testPixels(), 32, 24);
  assert.equal(cellsFrame(c).text.split("\n").length, 24);
});

test("clips round-trip and loop", () => {
  const frames = ["ab\ncd", { text: "xy\nzw", color: "0 \n 0" }];
  const bytes = encodeClip({ cols: 2, rows: 2, fps: 2, palette: { 0: "#fff" } }, frames, (u) => zlib.deflateRawSync(u));
  const clip = decodeClip(bytes, (u) => zlib.inflateRawSync(u));
  assert.equal(clip.header.frames, 2);
  assert.deepEqual(clip.frames, frames);
  const draw = clipPiece(clip).default();
  assert.equal(draw(0), "ab\ncd");
  assert.equal(draw(0.5).text, "xy\nzw");
  assert.equal(draw(1.0), "ab\ncd");
});

test("block font layout", () => {
  const l = layout("Hi");
  assert.equal(l.h, 5);
  assert.equal(l.w, 5 + 1 + 3);
  assert.equal(l.count, 2);
});

test("transitions: every kind goes from a to b, sequences merge palettes", async () => {
  const { mixFrames, TRANSITIONS, sequence, mergePalettes } = await import("../src/index.js");
  const a = { text: "aaaa\naaaa", color: "0000\n0000" }, b = { text: "bbbb\nbbbb", color: "0000\n0000" };
  const count = (f, ch) => [...f.text].filter((c) => c === ch).length;
  for (const k of TRANSITIONS) {
    assert.equal(count(mixFrames(k, a, b, 0, 4, 2), "a"), 8, k);
    assert.equal(count(mixFrames(k, a, b, 1, 4, 2), "b"), 8, k);
  }
  const m = mergePalettes([{ 0: "#ff0000" }, { 0: "#00ff00", 1: "#FF0000" }]);
  assert.deepEqual(m.palette, { 0: "#ff0000", 1: "#00ff00" });
  assert.deepEqual(m.maps[1], { 0: "1", 1: "0" });
  const p1 = fromSpec({ kind: "text", text: "A", effect: "plain" }), p2 = fromSpec({ kind: "text", text: "BB", effect: "plain" });
  const seq = sequence([p1, p2], { hold: 1, duration: 0.5 });
  const draw = seq.default();
  assert.equal(seq.meta.cols, Math.max(p1.meta.cols, p2.meta.cols));
  assert.equal(draw(0.5).text.split("\n").length, seq.meta.rows);
  assert.notDeepEqual(draw(0.5), draw(2.0), "the second piece shows after the first");
  for (const k of new Set(draw(1.25).color.replace(/[\n ]/g, ""))) assert.ok(seq.meta.palette[k], k);
});
