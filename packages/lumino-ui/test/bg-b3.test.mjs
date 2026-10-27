/*
 * b3's backgrounds (LuminoChrome, LuminoOrb, LuminoFrost, LuminoShards): their pure
 * layout and geometry, against dist/ (build first). The shared checks (loads, renders
 * the fallback and children, "use client") are in backgrounds.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { chromeMarkPlace, cardHalfSize } from "lumino-ui/lumino-chrome";
import { LuminoFrost, FROST_PARTS, frostCSS, partClipTransform, slabDrift, frostBlobs, frostFallback } from "lumino-ui/lumino-frost";
import { BRANDMARK } from "lumino-ui/brand";

test("chrome: the mark sits off-centre and inside the box, low right when wide, low when tall", () => {
  for (const aspect of [0.46, 0.75, 1, 1.33, 1.6, 2.4]) {
    const { x, y, size } = chromeMarkPlace(aspect);
    assert.ok(size > 0.3 && size < 1, `size at ${aspect}`);
    assert.ok(x > 0 && x < aspect && y > 0 && y < 0.5, `centre in the lower box at ${aspect}`);
    if (aspect >= 1) assert.ok(x > aspect * 0.65, `right of the card at ${aspect}`);
  }
  assert.deepEqual(cardHalfSize(1440, 900), [200 / 900, 230 / 900]);
  assert.deepEqual(cardHalfSize(300, 400), [150 / 400, 200 / 400], "never wider or taller than the box");
});

test("frost: the three parts' boxes hold their paths", () => {
  assert.equal(FROST_PARTS.length, 3);
  assert.deepEqual(FROST_PARTS.map((p) => p.path).sort(), [0, 1, 2]);
  for (const p of FROST_PARTS) {
    const [x, y, w, hh] = p.box;
    const nums = BRANDMARK.paths[p.path].match(/-?\d*\.?\d+/g).map(Number);
    assert.ok(w > 0 && hh > 0);
    // The path's first point is absolute: it must be inside the box.
    assert.ok(nums[0] >= x && nums[0] <= x + w && nums[1] >= y && nums[1] <= y + hh, `path ${p.path} starts in its box`);
    assert.match(partClipTransform(p), /^scale\([\d.]+ [\d.]+\) translate\(-[\d.]+ -[\d.]+\)$/);
  }
});

test("frost: CSS lays out every part, wide and tall, scoped", () => {
  const css = frostCSS(".x");
  for (const i of [0, 1, 2]) assert.equal(css.split(`.x [data-part="${i}"]{`).length, 3, `part ${i} in both layouts`);
  assert.match(css, /@container lumino-frost \(orientation: portrait\)\{/);
  assert.doesNotMatch(css, /NaN|undefined/);
});

test("frost: drift is deterministic, small, and leans with the pointer", () => {
  for (const i of [0, 1, 2]) {
    assert.deepEqual(slabDrift(i, 12.5), slabDrift(i, 12.5));
    for (let t = 0; t < 120; t += 7) {
      const d = slabDrift(i, t);
      assert.ok(Math.abs(d.x) < 4 && Math.abs(d.y) < 4 && Math.abs(d.rotate) < 2, `part ${i} at ${t}s stays near home`);
      assert.ok(d.sweep >= 0 && d.sweep < 1);
    }
    assert.ok(slabDrift(i, 3, 0.5, 0).x < slabDrift(i, 3, -0.5, 0).x, "parallax moves against the pointer");
  }
  assert.equal(frostBlobs(0).length, 6);
  assert.match(frostFallback(), /^radial-gradient\(.*#111013$/);
});

test("frost: the server HTML already has the three glass slabs and their clip paths", () => {
  const html = renderToString(h(LuminoFrost, { style: { height: 400 } }, h("p", null, "card")));
  assert.equal(html.match(/<div data-part="\d"/g).length, 3);
  assert.equal(html.match(/<clipPath /g).length, 3);
  assert.match(html, /backdrop-filter:blur\(22px\)/);
  assert.match(html, /container-type:size/);
  assert.match(html, /<p>card<\/p>/);
});

test("orb: right of the card when wide, above it when tall, always partly on screen", async () => {
  const { orbPlace } = await import("lumino-ui/lumino-orb");
  for (const aspect of [1.33, 1.6, 2.4]) {
    const { x, y, r } = orbPlace(aspect);
    assert.ok(x - r > aspect / 2 + 200 / 900 - 0.05, `clear of the card at ${aspect}`);
    assert.ok(x + r <= aspect + 0.01 && y - r >= 0 && y + r <= 1, `inside the box at ${aspect}`);
  }
  const phone = orbPlace(390 / 844);
  assert.ok(phone.y > 0.7 && phone.x < 390 / 844 + phone.r && phone.r > 0.1, "upper area on a phone");
});

test("shards: the mesh is deterministic, three vertices a shard, and only covers the shape", async () => {
  const { shardMesh } = await import("lumino-ui/lumino-shards");
  const disc = (x, y) => (x - 0.5) ** 2 + (y - 0.5) ** 2 < 0.16;
  const a = shardMesh(disc, { cols: 20, seed: 3 }), b = shardMesh(disc, { cols: 20, seed: 3 });
  assert.ok(a.count > 100);
  assert.deepEqual(a.home, b.home);
  assert.equal(a.local.length, a.count * 3 * 2);
  assert.equal(a.home.length, a.count * 3 * 2);
  assert.equal(a.bary.length, a.count * 3 * 3);
  assert.equal(a.rand.length, a.count * 3 * 4);
  for (let i = 0; i < a.home.length; i += 2) assert.ok(Math.hypot(a.home[i] - 0.5, a.home[i + 1] - 0.5) < 0.5, "homes near the disc");
  assert.equal(shardMesh(() => false, { cols: 20 }).count, 0);
});

test("glass mark: the server HTML is the flat mark in the brand gradient, sized and labelled", async () => {
  const { LuminoGlassMark, GLASS_MARK_PADDING } = await import("lumino-ui/lumino-glass-mark");
  const html = renderToString(h(LuminoGlassMark, { size: 180 }));
  assert.match(html, /role="img" aria-label="Lumino"/);
  assert.match(html, /width:180px;aspect-ratio:1/);
  assert.equal(html.match(/<path /g).length, 3);
  assert.equal(html.match(/<stop /g).length, 7);
  const id = html.match(/<linearGradient id="([^"]+)"/)[1];
  assert.match(html, new RegExp(`fill="url\\(#${id}\\)"`));
  assert.match(html, /<canvas /);
  assert.ok(html.includes(`left:${GLASS_MARK_PADDING * 100}%`));
  const deco = renderToString(h(LuminoGlassMark, { label: "" }));
  assert.match(deco, /aria-hidden="true"/);
  assert.doesNotMatch(deco, /role="img"/);
});
