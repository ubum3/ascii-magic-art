/*
 * dd's backgrounds (glass-prism-rays, apex-burst, arc-conduit, pillar-stage): the pure
 * parts, against dist/ (build first). The shaders and canvases are checked by eye with
 * scripts/shots.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BRANDMARK } from "lumino-ui/brand";
import { parsePath, perimeter, resample, bolt, nearest, rng } from "../dist/components/arc-conduit/outline.js";
import { conduitLayout } from "lumino-ui/arc-conduit";
import { markUV, HEART, burstLayout } from "lumino-ui/apex-burst";
import { prismLayout } from "lumino-ui/glass-prism-rays";
import { stageLayout } from "lumino-ui/pillar-stage";

test("parsePath turns each brandmark path into one closed polygon inside its bounds", () => {
  const [bx, by, bw, bh] = BRANDMARK.bounds;
  for (const d of BRANDMARK.paths) {
    const polys = parsePath(d);
    assert.equal(polys.length, 1);
    assert.ok(polys[0].length > 20);
    for (const [x, y] of polys[0]) {
      assert.ok(x >= bx - 2 && x <= bx + bw + 2 && y >= by - 2 && y <= by + bh + 2, `${x},${y} out of bounds`);
    }
  }
  // Absolute and relative commands, implicit repeats and Z.
  assert.deepEqual(parsePath("M0,0h10v10l-10,0Z"), [[[0, 0], [10, 0], [10, 10], [0, 10]]]);
  assert.deepEqual(parsePath("M0 0L5 0 5 5z"), [[[0, 0], [5, 0], [5, 5]]]);
  assert.deepEqual(parsePath("M0,0l1.5.5.5-1z"), [[[0, 0], [1.5, 0.5], [2, -0.5]]]);
  assert.throws(() => parsePath("M0,0a1,1,0,0,0,1,1"), /unsupported/);
});

test("parsePath follows curves: a cubic ends where it should and stays near its hull", () => {
  const [poly] = parsePath("M0,0c0,10,10,10,10,0z", 8);
  assert.equal(poly.length, 9);
  assert.deepEqual(poly.at(-1), [10, 0]);
  assert.ok(poly.every(([, y]) => y >= 0 && y <= 7.5 + 1e-9));
});

test("resample spaces points evenly around the polygon, in order", () => {
  const square = [[0, 0], [10, 0], [10, 10], [0, 10]];
  assert.equal(perimeter(square), 40);
  const pts = resample(square, 8);
  assert.deepEqual(pts, [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [5, 10], [0, 10], [0, 5]]);
  const base = resample(parsePath(BRANDMARK.paths[0])[0], 200);
  const gaps = base.map((p, i) => Math.hypot(base[(i + 1) % 200][0] - p[0], base[(i + 1) % 200][1] - p[1]));
  const step = perimeter(parsePath(BRANDMARK.paths[0])[0]) / 200;
  assert.ok(Math.max(...gaps) < step * 1.01, "no jumps along the outline");
});

test("bolt runs from a to b in 2^depth + 1 points, seeded", () => {
  const a = [0, 0], b = [100, 0];
  const pts = bolt(a, b, rng(3), 5);
  assert.equal(pts.length, 33);
  assert.deepEqual(pts[0], a);
  assert.deepEqual(pts.at(-1), b);
  assert.ok(pts.some(([, y]) => Math.abs(y) > 1), "it wanders off the straight line");
  assert.ok(pts.every(([, y]) => Math.abs(y) < 60), "but not far");
  assert.deepEqual(bolt(a, b, rng(3), 5), pts, "same seed, same bolt");
  assert.equal(nearest([[0, 0], [5, 5], [9, 1]], [8, 2]), 2);
});

test("rng is deterministic and stays in 0 to 1", () => {
  const r = rng(42), s = rng(42);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    assert.equal(v, s());
    assert.ok(v >= 0 && v < 1);
  }
});

test("markUV maps the viewBox into brandmarkSDF's square: the mark is centred, the heart sits in the slot", () => {
  const [bx, by, bw, bh] = BRANDMARK.bounds;
  const lo = markUV(bx, by + bh), hi = markUV(bx + bw, by);
  assert.ok(Math.abs(lo[0] - 0.12) < 1e-9 && Math.abs(hi[0] - 0.88) < 1e-9, "fits the width with 0.12 padding");
  assert.ok(Math.abs((lo[1] + hi[1]) / 2 - 0.5) < 1e-9, "centred vertically");
  assert.ok(Math.abs(HEART[0] - 0.5) < 1e-3);
  assert.ok(HEART[1] > lo[1] && HEART[1] < hi[1]);
});

test("layouts keep the marks clear of a centred card on desktop and phone", () => {
  for (const aspect of [1440 / 900, 390 / 844, 1]) {
    const prism = prismLayout(aspect);
    // The mark spans 0.66 of its square's height: its bottom stays above the card's top (~0.68).
    assert.ok(prism.center[1] - prism.scale * 0.33 > 0.68, `prism at ${aspect}`);
    const burst = burstLayout(aspect);
    assert.ok(burst.heart[1] - (HEART[1] - markUV(0, 1556)[1]) * burst.scale > 0.68, `burst at ${aspect}`);
    const stage = stageLayout(aspect);
    assert.ok(stage.apex[1] > 0.9 && stage.arc[1] + stage.arc[2] < 0.2, `stage at ${aspect}`);
    assert.ok(stage.footL[0] < aspect * 0.1 && stage.footR[0] > aspect * 0.9);
  }
  const { cx, cy, scale } = conduitLayout(1440, 900);
  const [, , bw] = BRANDMARK.bounds;
  assert.ok(cx - (bw * scale) / 2 > 720, "the conduit mark starts right of the middle");
  assert.ok(cy > 450, "and sits low");
});
