/* HalftoneTide (cd): server render, its dot-screen fallback, props, and the shader source. Against dist/. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { HalftoneTide } from "lumino-ui/halftone-tide";
import { TIDE } from "../dist/components/halftone-tide/glsl.js";

test("HalftoneTide renders its fallback and children on the server", () => {
  const html = renderToString(h(HalftoneTide, { dim: 0.4, spacing: 12, shape: "square", tideEvery: 8, className: "bg" }, h("h1", null, "Sign in")));
  assert.match(html, /data-lumino-bg=""/);
  assert.match(html, /class="bg"/);
  assert.match(html, /<h1>Sign in<\/h1>/);
  assert.match(html, /10px 10px/, "the CSS dot screen fallback");
  assert.match(html, /opacity:0/, "the canvas waits for its first frame");
  assert.doesNotMatch(html, /spacing|tideEvery|interactive/, "own props don't leak to the DOM");
});

test("HalftoneTide starts with \"use client\" and its shader is a complete program", () => {
  const src = fs.readFileSync(new URL("../src/components/halftone-tide/HalftoneTide.tsx", import.meta.url), "utf8");
  assert.ok(src.startsWith('"use client"'));
  const fs_ = TIDE("#define MARK_SPREAD 0.125\n");
  assert.ok(fs_.startsWith("#version 300 es"));
  for (const u of ["uCss", "uCssPerPx", "uSpacing", "uHex", "uTideEvery", "uPointer", "uMarkBox", "uPalette", "uMark"]) assert.match(fs_, new RegExp(`uniform \\w+ ${u};`), u);
  assert.match(fs_, /outColor = vec4/);
});
