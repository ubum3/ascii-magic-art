/*
 * Smoke tests against the built dist/: server rendering, the registry, and
 * where "use client" ends up. Run `npm run build` first (npm test does not).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";

import { AsciiPlayer, AsciiArt, AsciiHero, AsciiNotFound, AsciiLoader, AsciiEmptyState, EMPTY_PIECES, LOADER_VARIANTS, firstFrameHTML } from "../dist/index.js";
import { AsciiArt as ServerAsciiArt, AsciiHero as ServerAsciiHero } from "../dist/server.js";
import { definePiece, Grid, palette } from "../dist/kit.js";
import { CATALOG } from "../dist/catalog.js";
import { SIZES } from "../dist/registry/sizes.generated.js";
import { LOADERS } from "../dist/registry/loaders.generated.js";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";

const DIST = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PIECES = path.join(path.dirname(createRequire(import.meta.url).resolve("ascii-magic-art/package.json")), "pieces");
const preText = (html) => html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1] ?? null;
const lines = (inner) => inner.replace(/<[^>]+>/g, "").split("\n").length;

test("AsciiPlayer puts the first frame in the server HTML", () => {
  const html = renderToString(h(AsciiPlayer, { piece: torus }));
  assert.match(html, /data-ama=""/);
  assert.match(html, /role="img"/);
  assert.match(html, /aria-label="Spinning Torus, animated ASCII art"/);
  assert.equal(lines(preText(html)), torus.meta.rows);
});

test("the first frame is the same every time (server and client agree)", async () => {
  for (const slug of ["spinning-torus", "page-404", "matrix-rain", "game-of-life"]) {
    const mod = await import(`ascii-magic-art/pieces/${slug}.js`);
    assert.equal(firstFrameHTML(mod), firstFrameHTML(mod), slug);
  }
});

test("a look changes the first frame", () => {
  const plain = firstFrameHTML(torus), dots = firstFrameHTML(torus, { look: "dots" });
  assert.notEqual(plain, dots);
  assert.match(dots, /[·•●]/);
});

test("server AsciiArt sends the frame; picture pieces get a sized box", async () => {
  const html = renderToString(await ServerAsciiArt({ piece: "page-404" }));
  assert.equal(lines(preText(html)), SIZES["page-404"][1]);
  const pic = renderToString(await ServerAsciiArt({ piece: "ocean-sunset" }));
  assert.equal(preText(pic), "");
  assert.match(pic, /width:115\.584em;height:65\.016em/);
});

test("client AsciiArt by name holds the space with a box", () => {
  const html = renderToString(h(AsciiArt, { piece: "matrix-rain" }));
  assert.equal(preText(html), "");
  assert.match(html, /width:[\d.]+em;height:[\d.]+em/);
});

test("a bad slug on the server still renders", async () => {
  const html = renderToString(await ServerAsciiArt({ piece: "no-such-piece" }));
  assert.match(html, /<pre/);
});

test("AsciiHero scales with container units and renders children", async () => {
  const html = renderToString(await ServerAsciiHero({ piece: "spinning-torus", children: h("h1", null, "Hello") }));
  assert.match(html, /container-type:size/);
  assert.match(html, /font:max\(calc\(100cqw/);
  assert.match(html, /<h1>Hello<\/h1>/);
  assert.equal(lines(preText(html)), 24);
  const contain = renderToString(h(AsciiHero, { piece: torus, fit: "contain" }));
  assert.match(contain, /font:min\(/);
});

test("states render with title, description and action", () => {
  const html = renderToString(h(AsciiNotFound, { title: "Not found", description: "Nothing here", action: h("a", { href: "/" }, "Home") }));
  assert.match(html, /<h2[^>]*>Not found<\/h2>/);
  assert.match(html, /Nothing here/);
  assert.match(html, /href="\/"/);
  assert.ok(lines(preText(html)) > 1);
  for (const variant of LOADER_VARIANTS) assert.ok(preText(renderToString(h(AsciiLoader, { variant }))).length > 50, variant);
  assert.match(renderToString(h(AsciiEmptyState, { variant: "no-results", title: "No results" })), /No results/);
});

test("empty-state sizes match the pieces", () => {
  for (const [variant, e] of Object.entries(EMPTY_PIECES)) {
    assert.ok(SIZES[e.slug], `${variant}: no piece ${e.slug}`);
    assert.deepEqual([e.cols, e.rows], SIZES[e.slug].slice(0, 2), variant);
  }
});

test("definePiece makes a module the player can render", () => {
  const piece = definePiece({ slug: "hello", cols: 20, rows: 3, palette: palette(["#7ee787"]) }, () => {
    const g = new Grid(20, 3);
    return (t) => { g.clear(); g.text(1, 1, "hello " + Math.floor(t), "0"); return g.frame(); };
  });
  assert.equal(piece.meta.fps, 24);
  const html = renderToString(h(AsciiPlayer, { piece, t0: 7 }));
  assert.match(html, /<span style="color:#7ee787">hello 7<\/span>/);
});

test("the registry covers every piece, and every loader resolves to its own size", async () => {
  const files = fs.readdirSync(PIECES).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual(Object.keys(SIZES).sort(), files);
  assert.deepEqual(Object.keys(LOADERS).sort(), files);
  assert.equal(CATALOG.length, files.length);
  for (const slug of files) {
    const { meta } = await LOADERS[slug]();
    assert.deepEqual(SIZES[slug], [meta.cols, meta.rows, meta.cell === "square" ? 1 : 0], slug);
  }
});

test('"use client" only where it belongs', () => {
  const first = (f) => fs.readFileSync(path.join(DIST, f), "utf8").split("\n", 1)[0];
  for (const dir of ["client", "hooks"]) for (const f of fs.readdirSync(path.join(DIST, dir)).filter((f) => f.endsWith(".js")))
    assert.equal(first(`${dir}/${f}`), '"use client";', `${dir}/${f}`);
  assert.equal(first("rest.js"), '"use client";', "rest.js");
  for (const f of ["index.js", "server.js", "rest-server.js", "kit.js", "catalog.js", "core/look.js", "core/prerender.js", "core/resolve.js", "core/styles.js", "core/variants.js"])
    assert.notEqual(first(f), '"use client";', f);
  for (const f of ["extras.js", "lens.js", "shader.js"]) assert.equal(first(f), '"use client";', f);
});

test("server AsciiArt takes a library module by name, and refuses a custom one clearly", async () => {
  const html = renderToString(await ServerAsciiArt({ piece: torus }));
  assert.equal(lines(preText(html)), torus.meta.rows);
  const custom = definePiece({ slug: "mine", cols: 20, rows: 2 }, () => () => "x".repeat(20) + "\n" + "y".repeat(20));
  await assert.rejects(() => ServerAsciiArt({ piece: custom }), /use client/);
});

test("extras: specs and sequences render their first frame on the server, clips decode", async () => {
  const { AsciiSpec, AsciiSequence, AsciiClip, loadClip, useSpecPiece } = await import("../dist/extras.js");
  const { encodeClip } = await import("ascii-magic-art-extras");
  const zlib = await import("node:zlib");
  const spec = { kind: "text", text: "HI", effect: "plain" };
  const html = renderToString(h(AsciiSpec, { spec, t0: 2 }));
  assert.match(html, /aria-label="text, animated ASCII art"/);
  assert.match(preText(html), /█/);
  const bar = renderToString(h(AsciiSpec, { spec: { kind: "progress", cols: 20 }, state: { value: 0.5, label: "Up" }, t0: 1 }));
  assert.match(preText(bar), /50%/, "state reaches the first frame");
  const seq = renderToString(h(AsciiSequence, { pieces: [spec, torus], hold: 1 }));
  assert.equal(lines(preText(seq)), torus.meta.rows);
  assert.match(renderToString(h(AsciiClip, { src: "/x.amc" })), /aria-busy="true"/);
  const bytes = encodeClip({ cols: 2, rows: 1, fps: 2 }, ["ab", "cd"], (u) => zlib.deflateRawSync(u));
  const clip = await loadClip(bytes);
  assert.equal(clip.default()(0.6), "cd");
  assert.equal(typeof useSpecPiece, "function");
});

test("rest: ascii.rest pieces render their first frame on the server, and hold their size without it", async () => {
  const { AsciiRest: ServerRest } = await import("../dist/rest-server.js");
  const { AsciiRest, restSize, REST_CATALOG } = await import("../dist/rest.js");
  assert.equal(REST_CATALOG.length, 240);
  const size = restSize("rust");
  const html = renderToString(await ServerRest({ piece: "rust" }));
  assert.match(html, /aria-label="rust, animated ASCII art"/);
  assert.equal(lines(preText(html)), size.rows);
  assert.match(preText(html), /8/);
  const box = renderToString(h(AsciiRest, { piece: "night-coast" }));
  assert.doesNotMatch(box, /<pre[^>]*>[^<]+</, "no frame without the server");
  assert.throws(() => renderToString(h(AsciiRest, { piece: "nope" })), /no ascii.rest piece/);
});

test("shader: the server renders the fallback and never the shader, nor touches navigator", async () => {
  const { AsciiShader } = await import("../dist/shader.js");
  const Boom = () => { throw new Error("the shader rendered on the server"); };
  const html = renderToString(h(AsciiShader, { cols: 40, fallback: h(AsciiPlayer, { piece: torus }) }, h(Boom)));
  assert.match(html, /data-ama-shader=""/);
  assert.equal(lines(preText(html)), torus.meta.rows, "the fallback's first frame is in the HTML");
  const bare = renderToString(h(AsciiShader, { cols: 32 }, h(Boom)));
  assert.match(bare, /aria-busy="true"/);
  assert.match(bare, /aspect-ratio:32 \/ 18/);
});
