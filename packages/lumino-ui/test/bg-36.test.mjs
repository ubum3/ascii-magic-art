// Pure logic of session 36's backgrounds (FerroBloom, SilkWake, FieldLines, EtherImprint), against dist/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { ferroLayout } from "lumino-ui/ferro-bloom";
import { silkLayout } from "lumino-ui/silk-wake";
import { POLES, fieldLayout, markUV, placePoles } from "lumino-ui/field-lines";
import { imprintAt, IMPRINT_HUES } from "lumino-ui/ether-imprint";

const DESKTOP = 1440 / 900, PHONE = 390 / 844;

// The mark (about 0.76 x 0.66 of its square) must not cover the box's centre, where the card goes.
function clearOfCentre([x, y, size], aspect) {
  const halfW = 0.38 * size, halfH = 0.33 * size;
  return Math.abs(x - aspect / 2) > halfW || Math.abs(y - 0.5) > halfH;
}

test("layouts keep the mark off the centre, on desktop and phone", () => {
  for (const layout of [ferroLayout, silkLayout, fieldLayout]) {
    for (const aspect of [DESKTOP, PHONE, 1, 2.2, 0.75]) {
      const at = layout(aspect);
      assert.equal(at.length, 3);
      assert.ok(at.every(Number.isFinite), `${layout.name}(${aspect})`);
      assert.ok(at[2] > 0, `${layout.name}(${aspect}): positive size`);
      assert.ok(clearOfCentre(at, aspect), `${layout.name}(${aspect}) covers the centre: ${at}`);
    }
  }
});

test("field lines: the poles balance, so the far field closes", () => {
  assert.equal(POLES.reduce((s, [, , q]) => s + q, 0), 0);
  // Every pole lands inside the mark's square.
  for (const [x, y] of POLES) {
    const [u, v] = markUV(x, y, 0.12);
    assert.ok(u > 0.1 && u < 0.9 && v > 0.1 && v < 0.9, `${x},${y} -> ${u},${v}`);
  }
  // The blade tips sit high and the base low (y up).
  assert.ok(markUV(950, 470, 0.12)[1] > markUV(1000, 1310, 0.12)[1]);
});

test("field lines: placePoles scales whole line counts round the centre", () => {
  const p = placePoles(1, 0.5, 0.8, 14);
  assert.equal(p.length, POLES.length * 3);
  for (let i = 0; i < POLES.length; i++) {
    assert.equal(p[i * 3 + 2], POLES[i][2] * 14);
    assert.ok(Math.abs(p[i * 3] - 1) < 0.4 && Math.abs(p[i * 3 + 1] - 0.5) < 0.4);
  }
  // Integer line counts: the atan seams fall exactly between lines.
  assert.ok([...p].filter((_, i) => i % 3 === 2).every(Number.isInteger));
});

test("ether imprint: one imprint a period, cycling spots and hues, never the middle", () => {
  const a = imprintAt(0.5, 8, DESKTOP), b = imprintAt(8.5, 8, DESKTOP);
  assert.equal(a.index, 0);
  assert.equal(b.index, 1);
  assert.ok(Math.abs(a.age - 0.5) < 1e-9 && Math.abs(b.age - 0.5) < 1e-9);
  assert.notDeepEqual(a.at, b.at);
  assert.equal(a.hue, IMPRINT_HUES[0]);
  assert.equal(b.hue, IMPRINT_HUES[1]);
  assert.notEqual(a.turn, b.turn);
  for (const aspect of [DESKTOP, PHONE]) {
    for (let t = 0; t < 80; t += 8) {
      const { at } = imprintAt(t, 8, aspect);
      assert.ok(clearOfCentre([at[0] * aspect, at[1], at[2]], aspect), `t=${t} aspect=${aspect}: ${at}`);
    }
  }
  assert.equal(imprintAt(-1, 8, 1).index, 0);
});
