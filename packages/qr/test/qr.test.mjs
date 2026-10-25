import { test } from "node:test";
import assert from "node:assert/strict";
import { qrPiece, qrFrame, qrSpec, qr, QR_EFFECTS } from "../src/index.js";
import { decode } from "./render.js";

const ENTRANCES = QR_EFFECTS.filter((e) => e !== "none");
// Short enough for version 1 at ECC H; the others fill whatever version they ask for.
const textFor = (v) => (v === 1 ? "PAY-42" : `https://pay.example/r/${"x".repeat(v * 6)}?v=${v}`);

for (let v = 1; v <= 10; v++) {
  for (const ecc of ["L", "M", "Q", "H"]) {
    test(`round trip: version ${v}, ECC ${ecc}`, () => {
      const p = qrPiece(textFor(v), { version: v, ecc, warn: false });
      assert.ok(p.meta.qr.version >= v);
      assert.equal(decode(p.default()(p.meta.qr.settle), p.meta), textFor(v));
    });
  }
}

for (const effect of ENTRANCES) {
  const url = "https://pay.example/checkout/7f3a";
  test(`${effect}: settles to the exact still code and decodes, in two looks`, () => {
    const p = qrPiece(url, { effect }), draw = p.default();
    const still = qrFrame(url);
    for (const t of [1.5, 1.6, 3, 60]) assert.deepEqual(draw(t), { text: still.text, color: still.color }, `t=${t}`);
    assert.equal(decode(draw(2), p.meta), url, "original");
    assert.equal(decode(draw(2).text, p.meta), url, "mono (text only, ink colour)");
  });
  test(`${effect}: mid-entrance does not decode`, () => {
    const p = qrPiece(url, { effect }), draw = p.default();
    for (const t of [0.15, 0.5, 0.75]) assert.equal(decode(draw(t), p.meta), null, `t=${t}`);
  });
  test(`${effect}: deterministic, exact size, animates`, () => {
    const a = qrPiece(url, { effect }).default(), b = qrPiece(url, { effect }).default();
    const { cols, rows, palette } = qrPiece(url, { effect }).meta;
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const t = i / 30, f = a(t);
      assert.deepEqual(f, b(t));
      const T = f.text.split("\n"), C = f.color.split("\n");
      assert.equal(T.length, rows);
      for (let y = 0; y < rows; y++) { assert.equal([...T[y]].length, cols); assert.equal([...C[y]].length, cols); }
      for (const k of new Set(f.color.replace(/[\n ]/g, ""))) assert.ok(palette[k], `key ${k}`);
      seen.add(f.text + f.color);
    }
    assert.ok(seen.size > 10, `${seen.size} distinct frames`);
  });
}

test("quiet zone: at least 4 modules of light all round", () => {
  const f = qrFrame("https://pay.example", { quiet: 1 });
  const T = f.text.split("\n");
  assert.equal(f.qr.quiet, 4);
  for (const r of [0, 1]) assert.equal(T[r], "█".repeat(f.cols));
  for (const row of T) { assert.equal(row.slice(0, 4), "████"); assert.equal([...row].slice(-4).join(""), "████"); }
});

test("contrast: dark must be at most a quarter of light's luminance", () => {
  assert.throws(() => qrFrame("x", { light: "#ffffff", dark: "#909090" }), /too close/);
  assert.throws(() => qrFrame("x", { light: "#202020", dark: "#101010" }), /too close/);
  assert.doesNotThrow(() => qrFrame("x", { light: "#ffffff", dark: "#404040" }));
});

test("reduced motion and still: the settled code from the first frame", () => {
  const url = "https://pay.example/r/1";
  const p = qrPiece(url, { reducedMotion: true });
  assert.equal(p.meta.still, true);
  assert.equal(decode(p.default()(0), p.meta), url);
  assert.equal(qrPiece(url, { effect: "none" }).meta.still, true);
});

test("logo: needs ECC H, at most 15%, and still decodes", () => {
  const url = "https://pay.example/r/merchant-onboarding-12345";
  const p = qrPiece(url, { logo: "PAY" });
  assert.equal(p.meta.qr.ecc, "H");
  const f = p.default()(5);
  assert.match(f.text, / PAY /);
  assert.equal(decode(f, p.meta), url);
  assert.throws(() => qrPiece(url, { logo: "PAY", ecc: "M" }), /needs ecc H/);
  assert.throws(() => qrPiece("hi", { logo: "MERCHANT CO" }), /15%/);
});

test("warns above version 7", () => {
  const warn = console.warn, seen = [];
  console.warn = (m) => seen.push(m);
  try { qrPiece(textFor(9), { version: 9 }); qrPiece(textFor(5), { version: 5 }); } finally { console.warn = warn; }
  assert.equal(seen.length, 1);
  assert.match(seen[0], /version 9/);
});

test("qrSpec is a plain JSON spec for the extras kind", () => {
  const spec = qrSpec("https://x.io", { brand: "#635bff", effect: "matrix" });
  assert.deepEqual(JSON.parse(JSON.stringify(spec)), { kind: "qr", text: "https://x.io", accent: "#635bff", effect: "matrix" });
  assert.equal(qr(spec).meta.palette[1], "#635bff");
  assert.throws(() => qr({ kind: "qr" }), /needs text/);
});
