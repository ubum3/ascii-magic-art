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

test("layout: regions in order, spaces show through, palettes merge", () => {
  const spec = {
    kind: "layout", cols: 6, rows: 3,
    regions: [
      { id: "a", x: 0, y: 0, w: 6, h: 3, spec: { kind: "progress", cols: 6, rows: 2, colors: ["#ff0000", "#00ff00", "#0000ff"] } },
      { id: "b", x: 1, y: 1, w: 3, h: 1, spec: { kind: "ticker", cols: 3, rows: 1, speed: 0 } },
    ],
  };
  const p = fromSpec(spec);
  assert.equal(p.meta.cols, 6);
  assert.equal(p.meta.rows, 3);
  const d = p.default();
  const f = d(5, { regions: { a: { value: 1, label: "" }, b: { items: [{ label: "X Y" }] } } });
  const rows = f.text.split("\n"), cols = f.color.split("\n");
  assert.equal(rows.length, 3);
  assert.ok(rows.every((r) => [...r].length === 6));
  // the ticker's "X Y" lands at x 1..3 of row 1; its space keeps the bar under it
  const bar = fromSpec({ kind: "progress", cols: 6, rows: 2, colors: ["#ff0000", "#00ff00", "#0000ff"] }).default()(5, { value: 1, label: "" });
  const barRow = [...bar.text.split("\n")[1]];
  assert.equal([...rows[1]][1], "X");
  assert.equal([...rows[1]][2], barRow[2], "a space in an overlay is transparent");
  assert.equal([...rows[1]][3], "Y");
  for (const k of new Set(f.color.replace(/[\n ]/g, ""))) assert.ok(p.meta.palette[k], `key ${k} in the merged palette`);
  // the ticker's label colour (its accent) is a key of its own in the merged palette
  assert.equal(p.meta.palette[[...cols[1]][1]], "#ffffff");
});

test("layout: play regions wait, play for their seconds, and replay on a new number", () => {
  const spec = { kind: "layout", cols: 20, rows: 6, regions: [{ id: "c", play: 1, spec: { kind: "celebrate", style: "confetti" } }] };
  const d = fromSpec(spec).default();
  const ink = (f) => f.text.replace(/[\n ]/g, "").length;
  assert.equal(ink(d(0, {})), 0, "hidden until played");
  assert.equal(ink(d(1, { play: {} })), 0);
  assert.ok(ink(d(2, { play: { c: 1 } })) > 0, "plays when its number appears");
  assert.ok(ink(d(2.5, { play: { c: 1 } })) > 0);
  assert.equal(ink(d(3.1, { play: { c: 1 } })), 0, "hidden after `play` seconds");
  assert.ok(ink(d(4, { play: { c: 2 } })) > 0, "a new number plays it again");
});

test("layout: drift moves everything, opaque regions clear what is under them", () => {
  const base = { kind: "layout", cols: 12, rows: 5, regions: [{ x: 4, y: 2, w: 4, h: 1, spec: { kind: "text", text: "AB", font: "plain", effect: "plain" } }] };
  const still = fromSpec(base).default(), moved = fromSpec({ ...base, drift: { cells: 2, period: 4 } }).default();
  assert.equal(still(1).text, fromSpec(base).default()(0).text);
  assert.notEqual(moved(1).text, still(1).text, "a quarter period in, it has moved");
  assert.equal(moved(0).text, still(0).text, "no drift at t=0");
  const o = fromSpec({ kind: "layout", cols: 6, rows: 1, regions: [
    { spec: { kind: "ticker", cols: 6, speed: 0, items: [{ label: "ABCDEF" }] } },
    { x: 2, w: 2, opaque: true, spec: { kind: "ticker", cols: 2, speed: 0, items: [{ label: "  " }] } },
  ] }).default();
  assert.equal(o(0).text, "AB  EF");
});

test("celebrate: coins fall and settle, hues recolour", () => {
  const p = fromSpec({ kind: "celebrate", cols: 30, rows: 8, style: "coins" });
  assert.match(p.meta.palette["2"], /^#(ffd23f|f5b700|ffe58a|e09f1f)$/);
  const f = p.default()(4).text.split("\n");
  assert.match(f[7], /[◎¢$]/, "settled on the floor");
  const h = fromSpec({ kind: "celebrate", style: "fireworks", hues: ["#123456"] });
  assert.equal(h.meta.palette["2"], "#123456");
  assert.equal(h.meta.palette["9"], "#123456");
});
