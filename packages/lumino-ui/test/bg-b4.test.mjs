/*
 * b4's background (LuminoFibers), against dist/ (build first). The shared checks
 * (loads, renders the fallback and children, "use client") are in backgrounds.test.mjs.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { LuminoFibers, FIBERS_MARK } from "lumino-ui/lumino-fibers";
import { BRANDMARK } from "lumino-ui/brand";

test("fibers: the brandmark glyph is the brand's own paths", () => {
  assert.deepEqual(FIBERS_MARK.paths, BRANDMARK.paths);
  assert.deepEqual(FIBERS_MARK.viewBox, BRANDMARK.viewBox);
  assert.ok(FIBERS_MARK.scale > 1);
});

test("fibers: the server HTML is the fallback, the fibers' box, and your content, with no glass mark", () => {
  const html = renderToString(h(LuminoFibers, { style: { height: 500 } }, h("p", null, "card")));
  assert.match(html, /data-lumino-bg/);
  assert.match(html, /class="ghost-fibers-container"/);
  assert.match(html, /#111013/);
  assert.match(html, /<p>card<\/p>/);
  assert.doesNotMatch(html, /lumino-glass-mark/);
});
