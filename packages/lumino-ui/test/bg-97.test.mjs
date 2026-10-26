/*
 * The pure parts of 97's backgrounds (globe-dawn, accretion-lens, brandmark-galaxy,
 * nebula-constellation): their layouts keep the art clear of a centred card, and the
 * constellation forms, holds and dissolves on time. Against dist/ (build first).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { globeLayout, riseAt } from "lumino-ui/globe-dawn";
import { holeLayout } from "lumino-ui/accretion-lens";
import { galaxyLayout } from "lumino-ui/brandmark-galaxy";
import { constellationAt, slots, STARS, EDGES, CYCLE, START } from "lumino-ui/nebula-constellation";

const ASPECTS = [390 / 844, 0.75, 1, 1440 / 900, 2.4];
// The card's box: about 380 x 330 CSS px at 1440 x 900, centred; on phones the full width.
const card = (aspect) => (aspect < 1 ? { w: aspect * 0.92, h: 0.4 } : { w: 0.42, h: 0.37 });

test("GlobeDawn: the globe sits low, the mark rises off its limb, clear of the card's middle", () => {
  for (const a of ASPECTS) {
    const { globe: [cx, cy, R], sun: [sx, sy, side] } = globeLayout(a);
    assert.ok(cy + R < 0.45, `limb top below the middle at ${a}`);
    const reach = Math.hypot(sx - cx, sy - cy);
    assert.ok(reach > R && reach < R + side * 0.5, `the mark sits just above the limb at ${a}`);
    assert.ok(Math.abs(sy - 0.5) > 0.15, `the mark is off the vertical middle at ${a}`);
  }
  assert.equal(riseAt(0), 0.55);
  assert.equal(riseAt(100), 1);
  assert.ok(riseAt(1) > riseAt(0.5));
});

test("AccretionLens: the hole is off to a corner or the top", () => {
  for (const a of ASPECTS) {
    const [x, y, side] = holeLayout(a);
    const { w, h } = card(a);
    const clearX = Math.abs(x - a / 2) - side * 0.3 > w / 2, clearY = Math.abs(y - 0.5) - side * 0.25 > h / 2;
    assert.ok(clearX || clearY, `the mark clears the card at ${a}`);
    assert.ok(x > 0 && x < a && y > 0 && y < 1, "on screen");
  }
});

test("BrandmarkGalaxy: the nucleus is clear of the card, the disk tilted", () => {
  for (const a of ASPECTS) {
    const { galaxy: [x, y], shape: [cosTilt], markSide } = galaxyLayout(a);
    const { w, h } = card(a);
    const clearX = Math.abs(x - a / 2) - markSide * 0.4 > w / 2, clearY = Math.abs(y - 0.5) - markSide * 0.35 > h / 2;
    assert.ok(clearX || clearY, `the nucleus clears the card at ${a}`);
    assert.ok(cosTilt > 0.3 && cosTilt < 0.7);
  }
});

test("NebulaConstellation: a valid figure, formed at time 0, gone by the end of a cycle", () => {
  for (const [a, b] of EDGES) assert.ok(a < STARS.length && b < STARS.length);
  const ys = STARS.map(([, y]) => y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.9 && Math.max(...ys) - Math.min(...ys) < 1.1, "about one mark height");

  const f = constellationAt(0, 1.6);
  assert.ok(f.fill > 0.4, "the glass fill shows at once");
  assert.ok([...f.lineAlpha].every((x) => x === 1), "every line drawn");
  STARS.forEach(([x, y], i) => {
    assert.ok(Math.abs(f.stars[i * 3] - (f.center[0] + x * f.size)) < 1e-4, "stars at home");
    assert.ok(Math.abs(f.stars[i * 3 + 1] - (f.center[1] + y * f.size)) < 1e-4);
  });

  const gone = constellationAt(CYCLE - START - 0.5, 1.6);
  assert.equal(gone.fill, 0);
  assert.ok([...gone.lineAlpha].every((x) => x === 0), "lines faded");

  const next = constellationAt(CYCLE, 1.6);
  assert.notDeepEqual(next.center, f.center, "the next cycle forms elsewhere");
});

test("NebulaConstellation: every slot keeps the whole figure on screen and off the card", () => {
  for (const a of ASPECTS) {
    const { centers, size } = slots(a);
    const { w, h } = card(a);
    for (const [x, y] of centers) {
      assert.ok(x - 0.58 * size >= 0 && x + 0.58 * size <= a, `inside horizontally at ${a}`);
      assert.ok(y - 0.5 * size >= 0 && y + 0.5 * size <= 1, `inside vertically at ${a}`);
      const clearX = Math.abs(x - a / 2) - 0.58 * size > w / 2 - 0.05, clearY = Math.abs(y - 0.5) - 0.5 * size > h / 2 - 0.05;
      assert.ok(clearX || clearY, `clear of the card at ${a}`);
    }
  }
});
