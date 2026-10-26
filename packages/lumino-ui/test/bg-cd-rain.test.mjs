/*
 * SignalRain (signal-rain), against dist/ (build first): it renders on the server
 * inside BackgroundFrame with its own fallback, takes its props, and the shader
 * has what the component binds.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { SignalRain } from "lumino-ui/signal-rain";
import { BRAND_FALLBACK } from "lumino-ui/backgrounds";

test("SignalRain renders its own fallback, the dim layer and children on the server", () => {
  const html = renderToString(h(SignalRain, { dim: 0.4, density: 0.7, glyphs: "01", accent: "", cellSize: 20, glow: 1.5, className: "rain" }, h("p", null, "card")));
  assert.match(html, /data-lumino-bg=""/);
  assert.match(html, /class="rain"/);
  assert.match(html, /<p>card<\/p>/);
  assert.match(html, /<canvas/);
  assert.match(html, /opacity:0/, "the art waits for the first frame");
  assert.match(html, /repeating-linear-gradient/, "the rain's own fallback");
  assert.ok(!html.includes(BRAND_FALLBACK.slice(0, 40)), "not the generic brand fallback");
  assert.match(html, /radial-gradient\(ellipse/, "dim");
  assert.doesNotMatch(html, /density|cellSize/, "its own props are not passed to the DOM");
});

test("SignalRain's source: client component, shader uniforms match what it binds", async () => {
  const src = fs.readFileSync(new URL("../src/components/signal-rain/SignalRain.tsx", import.meta.url), "utf8");
  assert.ok(src.startsWith('"use client"'));
  const { RAIN } = await import("../dist/components/signal-rain/glsl.js");
  const glsl = RAIN("#define MARK_SPREAD 0.125\n");
  assert.match(glsl, /^#version 300 es/);
  for (const u of ["uPalette", "uMark", "uAtlas", "uResolution", "uTime", "uCell", "uDensity", "uGlyphs", "uAccent", "uSlots", "uGlow", "uParallax"]) {
    assert.match(glsl, new RegExp(`uniform \\w+ ${u};`), u);
    assert.ok(src.includes(`u.${u}`), `binds ${u}`);
  }
});
