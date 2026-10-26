/*
 * LuminoGlyphs: GradientASCII's word-overlay helpers (ported from lumino-services
 * gradient-ascii-overlay.test.ts), against dist/ (build first).
 *   - the atlas is the deduped ramp, then word-only characters after it
 *   - a stamp is a random word on a random cell that fits the grid
 *   - a stamp fades in, types one glyph at a time, holds, and fades out
 *   - the overlay grid holds index + 1 and strength for exactly the typed cells
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import {
  STAMP_IN,
  STAMP_OUT,
  STAMP_TYPE,
  bandRows,
  glyphList,
  markTable,
  spawnStamp,
  stampStrength,
  visibleGlyphs,
  wordIndices,
  writeOverlay,
} from "../dist/components/lumino-glyphs/overlay.js";
import { LuminoGlyphs, GradientASCII, GradientAscii, GLYPHS_FALLBACK } from "lumino-ui/lumino-glyphs";

const close = (actual, expected, digits = 2) =>
  assert.ok(Math.abs(actual - expected) < 10 ** -digits / 2, `${actual} ≈ ${expected}`);

describe("glyphList", () => {
  it("dedupes the ramp and bounds the tone pick by it", () => {
    const { list, rampCount } = glyphList(" 014821278@#+=", []);
    assert.equal(list.join(""), " 014827@#+=");
    assert.equal(rampCount, 11);
  });

  it("appends word characters the ramp lacks, after the ramp", () => {
    const { list, rampCount } = glyphList(" 01", ["48", "212", "1x"]);
    assert.equal(list.join(""), " 01482x");
    assert.equal(rampCount, 3);
  });

  it("falls back to a blank atlas and ignores line breaks", () => {
    assert.deepEqual(glyphList("\n", []).list, [" "]);
    assert.deepEqual(glyphList("ab", ["\r\n"]).list, ["a", "b"]);
  });
});

describe("wordIndices", () => {
  it("maps a word to atlas indices and drops unknown characters", () => {
    const { list } = glyphList(" 0148", []);
    assert.deepEqual(wordIndices("48", list), [3, 4]);
    assert.deepEqual(wordIndices("4z8", list), [3, 4]);
  });
});

describe("spawnStamp", () => {
  it("places a random word fully inside the grid", () => {
    const words = [
      [3, 4],
      [2, 1, 2],
    ];
    const stamp = spawnStamp(words, 10, 4, () => 0.999);
    assert.notEqual(stamp, null);
    assert.deepEqual(stamp.glyphs, [2, 1, 2]);
    assert.ok(stamp.col + stamp.glyphs.length <= 10);
    assert.equal(stamp.row, 3);
    assert.equal(stamp.age, 0);
    assert.deepEqual(spawnStamp(words, 10, 4, () => 0), { col: 0, row: 0, glyphs: [3, 4], age: 0 });
  });

  it("skips words wider than the grid and returns null when none fit", () => {
    assert.deepEqual(spawnStamp([[1, 2, 3], [7]], 2, 2, () => 0.5).glyphs, [7]);
    assert.equal(spawnStamp([[1, 2, 3]], 2, 2, () => 0.5), null);
    assert.equal(spawnStamp([[]], 2, 2, () => 0.5), null);
  });
});

describe("stampStrength", () => {
  it("is 0 at birth, 1 while held, and 0 again at the end of life", () => {
    assert.equal(stampStrength(0, 2.5), 0);
    close(stampStrength(STAMP_IN / 2, 2.5), 0.5);
    assert.equal(stampStrength(1.2, 2.5), 1);
    close(stampStrength(2.5 - STAMP_OUT / 2, 2.5), 0.5);
    assert.equal(stampStrength(2.5, 2.5), 0);
    assert.equal(stampStrength(3, 2.5), 0);
  });
});

describe("visibleGlyphs", () => {
  it("types one glyph per step, starting with one", () => {
    assert.equal(visibleGlyphs(0), 1);
    assert.equal(visibleGlyphs(STAMP_TYPE * 1.5), 2);
    assert.equal(visibleGlyphs(STAMP_TYPE * 3), 4);
  });
});

describe("writeOverlay", () => {
  const cols = 4;
  const rows = 2;
  const cell = (buffer, col, row) => [buffer[(row * cols + col) * 2], buffer[(row * cols + col) * 2 + 1]];

  it("writes index + 1 and strength for the typed cells only", () => {
    const buffer = new Uint8Array(cols * rows * 2).fill(9);
    const stamps = [{ col: 1, row: 1, glyphs: [3, 4, 5], age: STAMP_TYPE * 1.5 }];
    assert.equal(writeOverlay(stamps, cols, rows, 2.5, buffer), true);
    assert.deepEqual(cell(buffer, 1, 1), [4, 255]);
    assert.deepEqual(cell(buffer, 2, 1), [5, 255]);
    assert.deepEqual(cell(buffer, 3, 1), [0, 0]);
    assert.deepEqual(cell(buffer, 0, 0), [0, 0]);
    assert.deepEqual(cell(buffer, 1, 0), [0, 0]);
  });

  it("clears the grid and reports nothing written when stamps are dead", () => {
    const buffer = new Uint8Array(cols * rows * 2).fill(9);
    assert.equal(writeOverlay([{ col: 0, row: 0, glyphs: [1], age: 2.5 }], cols, rows, 2.5, buffer), false);
    assert.ok([...buffer].every((byte) => byte === 0));
  });

  it("clips cells outside the grid and lets later stamps win", () => {
    const buffer = new Uint8Array(cols * rows * 2);
    const stamps = [
      { col: 3, row: 0, glyphs: [1, 2], age: 1 },
      { col: 3, row: 0, glyphs: [7], age: 1 },
      { col: 0, row: 5, glyphs: [1], age: 1 },
    ];
    writeOverlay(stamps, cols, rows, 2.5, buffer);
    assert.deepEqual(cell(buffer, 3, 0), [8, 255]);
    assert.equal(buffer.length, cols * rows * 2);
  });
});

describe("markTable", () => {
  it("pairs each chanced mark's atlas index with its chance, zero-padded", () => {
    const { list } = glyphList(" 014◆827", []);
    const table = markTable(
      [
        { key: "◆", chance: 0.3 },
        { key: "8" },
        { key: "z", chance: 0.5 },
        { key: "0", chance: 2 },
      ],
      list,
    );
    assert.deepEqual(Array.from(table, (v) => Math.round(v * 1000) / 1000), [4, 0.3, 1, 1, 0, 0, 0, 0]);
  });
});

describe("bandRows", () => {
  it("maps a top-down band onto bottom-up rows", () => {
    assert.deepEqual(bandRows(10, [0, 1]), [0, 9]);
    assert.deepEqual(bandRows(10, [0, 0.5]), [5, 9]);
    assert.deepEqual(bandRows(10, [0.5, 1]), [0, 4]);
    assert.deepEqual(bandRows(10, [0.25, 0.5]), [5, 7]);
  });

  it("always yields at least one row and clamps a bad band", () => {
    assert.deepEqual(bandRows(10, [0.99, 0.995]), [0, 0]);
    assert.deepEqual(bandRows(10, [0.75, 0.2]), [2, 2]);
    assert.deepEqual(bandRows(1, [0, 0.5]), [0, 0]);
  });

  it("keeps spawned stamps inside the band", () => {
    for (const r of [0, 0.3, 0.999]) {
      const stamp = spawnStamp([[1]], 4, 10, () => r, [0, 0.5]);
      assert.ok(stamp.row >= 5 && stamp.row <= 9, String(stamp.row));
    }
  });
});

describe("LuminoGlyphs on the server", () => {
  it("shows its horizon fallback with the art hidden, and GradientASCII stays exported", () => {
    const html = renderToString(h(LuminoGlyphs, null, h("p", null, "card")));
    assert.ok(html.includes(GLYPHS_FALLBACK.slice(0, 30)), "the glyphs fallback is the background");
    assert.match(html, /opacity:0/);
    assert.match(html, /<canvas/);
    assert.match(html, /<p>card<\/p>/);
    assert.equal(GradientAscii, GradientASCII);
    assert.match(renderToString(h(GradientASCII, { style: { position: "absolute" }, className: "y" })), /class="y" style="position:absolute;width:100%;height:100%;overflow:hidden"|style="position:absolute;width:100%;height:100%;overflow:hidden" class="y"/);
  });
});
