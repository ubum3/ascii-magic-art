import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createServer } from "../src/server.js";
import { OUT_DIR } from "../src/guard.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
fs.mkdirSync(OUT_DIR, { recursive: true });
const work = fs.mkdtempSync(path.join(OUT_DIR, "test-"));
// inputs must be inside the working directory or the temp folder, so the test logo is copied to the temp folder
const MARK = path.join(work, "mark.svg");
fs.copyFileSync(path.join(HERE, "../../extras/examples/mark.svg"), MARK);
let client;
const call = (name, args) => client.callTool({ name, arguments: args });
const body = (r) => r.content.map((c) => c.text || "").join("\n");

before(async () => {
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createServer().connect(a);
  client = new Client({ name: "test", version: "0" });
  await client.connect(b);
});
after(() => client.close());

test("tools/list: the five tools and their inputs", async () => {
  const { tools } = await client.listTools();
  const shape = Object.fromEntries(tools.map((t) => [t.name, { props: Object.keys(t.inputSchema.properties), required: t.inputSchema.required || [] }]));
  assert.deepEqual(shape, {
    search_pieces: { props: ["query", "category", "tag", "limit"], required: [] },
    render_frame: { props: ["source", "t", "state", "color"], required: ["source"] },
    make_banner: { props: ["text", "font", "effect", "colors", "t"], required: ["text"] },
    svg_to_brand: { props: ["path", "cols", "effect", "idle", "style", "out", "overwrite"], required: ["path"] },
    export: { props: ["source", "format", "out", "seconds", "t", "preset", "dark", "state", "overwrite"], required: ["source", "format"] },
  });
  const ex = tools.find((t) => t.name === "export");
  assert.deepEqual(ex.inputSchema.properties.format.enum, ["cast", "gif", "png", "mp4", "webm", "svg"]);
  assert.equal(tools.find((t) => t.name === "search_pieces").inputSchema.properties.limit.maximum, 50);
});

test("search_pieces: words, filters and the limit", async () => {
  const r = JSON.parse(body(await call("search_pieces", { query: "space" , limit: 50 })));
  assert.ok(r.results.some((e) => e.slug === "alien-wave"));
  assert.ok(r.results.every((e) => e.slug && e.name && e.cols && e.rows));
  const exact = JSON.parse(body(await call("search_pieces", { query: "alien-wave" })));
  assert.equal(exact.results[0].slug, "alien-wave", "an exact slug comes first");
  const cat = JSON.parse(body(await call("search_pieces", { category: "arcade", limit: 50 })));
  assert.ok(cat.total > 0 && cat.results.every((e) => e.category === "arcade"));
  const all = JSON.parse(body(await call("search_pieces", {})));
  assert.ok(all.total >= 634, `total ${all.total}`);
  assert.equal(all.results.length, 10);
  assert.equal(JSON.parse(body(await call("search_pieces", { query: "zzzqqq" }))).total, 0);
  const bad = await call("search_pieces", { limit: 51 });
  assert.equal(bad.isError, true, "limit is at most 50");
});

test("render_frame: text in a code block, the same every time", async () => {
  const a = await call("render_frame", { source: "alien-wave", t: 2 });
  const b = await call("render_frame", { source: "alien-wave", t: 2 });
  assert.equal(body(a), body(b));
  assert.match(a.content[0].text, /^alien-wave · 64×28 · 20 fps · arcade$/);
  const lines = a.content[1].text.split("\n");
  assert.equal(lines[0], "```");
  assert.equal(lines.length, 28 + 2);
  assert.ok(!body(a).includes("\x1b"));
  const c = await call("render_frame", { source: "alien-wave", t: 2, color: true });
  assert.ok(c.content[2].text.includes("\x1b[38;2;"));
  const spec = await call("render_frame", { source: { kind: "progress", cols: 20 }, state: { value: 0.5, label: "Up" }, t: 0 });
  assert.ok(spec.content[1].text.includes("█"));
  const missing = await call("render_frame", { source: "alien-wav" });
  assert.equal(missing.isError, true);
  assert.match(body(missing), /Did you mean: alien-wave/);
  const wide = await call("render_frame", { source: { kind: "text", text: "W".repeat(60), font: "block" } });
  assert.match(wide.content[0].text, /cut to 200×100/);
  assert.ok(wide.content[1].text.split("\n").every((l) => [...l].length <= 200));
});

test("make_banner: a text spec and its frame", async () => {
  const r = await call("make_banner", { text: "SHIP", effect: "wave", colors: ["#ff0000"] });
  assert.deepEqual(JSON.parse(r.content[0].text), { kind: "text", text: "SHIP", font: "block", effect: "wave", colors: ["#ff0000"] });
  assert.ok(r.content[1].text.includes("█"));
  assert.equal((await call("make_banner", { text: "x".repeat(65) })).isError, true);
  assert.equal((await call("make_banner", { text: "HI", colors: ["red"] })).isError, true);
});

test("svg_to_brand: a logo to a brand spec, written where asked", async () => {
  const out = path.join(work, "mark.json");
  const r = await call("svg_to_brand", { path: MARK, cols: 40, effect: "assemble", out });
  assert.equal(r.isError, undefined, body(r));
  const spec = JSON.parse(r.content[0].text);
  assert.equal(spec.kind, "brand");
  assert.equal(spec.cov[0].length, 40);
  assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), spec);
  const again = await call("svg_to_brand", { path: MARK, out });
  assert.equal(again.isError, true, "no overwrite unless asked");
  assert.match(body(again), /overwrite/);
  assert.equal((await call("svg_to_brand", { path: MARK, out, overwrite: true })).isError, undefined);
});

test("limits: paths outside the roots are refused", async () => {
  const outside = await call("svg_to_brand", { path: "/etc/hostname" });
  assert.equal(outside.isError, true);
  assert.match(body(outside), /outside|no file/);
  const up = await call("render_frame", { source: "../../../../../../../etc/passwd.json" });
  assert.equal(up.isError, true);
  for (const out of ["/etc/ama.png", path.join(os.homedir(), "ama-test-should-not-exist.png"), path.join(OUT_DIR, "../../x.png")]) {
    const r = await call("export", { source: "alien-wave", format: "png", out });
    assert.equal(r.isError, true, out);
    assert.match(body(r), /can't write/);
    assert.ok(!fs.existsSync(out));
  }
  const link = path.join(work, "link.png");
  fs.symlinkSync("/etc/hostname", link);
  const viaLink = await call("export", { source: "alien-wave", format: "png", out: link, overwrite: true });
  assert.equal(viaLink.isError, true);
  assert.match(body(viaLink), /symlink/);
});

test("export: png and gif come back as files and images, cast as a file", async () => {
  const png = await call("export", { source: "alien-wave", format: "png", t: 2 });
  const info = JSON.parse(png.content[0].text);
  assert.equal(info.format, "png");
  assert.ok(info.path.startsWith(fs.realpathSync(os.tmpdir())) && fs.existsSync(info.path));
  assert.equal(png.content[1].type, "image");
  assert.equal(png.content[1].mimeType, "image/png");
  assert.equal(Buffer.from(png.content[1].data, "base64").subarray(1, 4).toString(), "PNG");
  const out = path.join(work, "wave");
  const gif = await call("export", { source: { kind: "text", text: "GO", effect: "wave" }, format: "gif", seconds: 1, out });
  assert.equal(gif.isError, undefined, body(gif));
  const g = JSON.parse(gif.content[0].text);
  assert.equal(g.path, fs.realpathSync(work) + "/wave.gif", "the extension follows the format");
  assert.equal(fs.readFileSync(g.path).subarray(0, 6).toString(), "GIF89a");
  assert.equal(gif.content[1].mimeType, "image/gif");
  const cast = await call("export", { source: "alien-wave", format: "cast", seconds: 1, out: path.join(work, "a.cast") });
  const c = JSON.parse(cast.content[0].text);
  assert.equal(JSON.parse(fs.readFileSync(c.path, "utf8").split("\n")[0]).version, 2);
  assert.equal(cast.content.length, 1, "no image for a cast");
  const long = await call("export", { source: "alien-wave", format: "cast", seconds: 31 });
  assert.equal(long.isError, true, "seconds is at most 30");
});

test("export: an animated svg", async () => {
  const r = await call("export", { source: "alien-wave", format: "svg", seconds: 1, out: path.join(work, "a.svg") });
  assert.equal(r.isError, undefined, body(r));
  assert.ok(fs.readFileSync(JSON.parse(r.content[0].text).path, "utf8").includes("<svg"));
});

test("ascii.rest pieces: searchable, renderable, and glyph logos", async () => {
  const hits = JSON.parse(body(await call("search_pieces", { query: "rust", limit: 50 })));
  assert.ok(hits.results.some((h) => h.slug === "rest-rust"), "rest-rust is found");
  const fr = await call("render_frame", { source: "rest-rust", t: 1 });
  assert.equal(fr.isError, undefined, body(fr));
  assert.match(body(fr), /8888/);
  assert.equal((await call("render_frame", { source: "rest-nope" })).isError, true);
  const g = await call("svg_to_brand", { path: MARK, cols: 40, style: "glyphs" });
  assert.equal(g.isError, undefined, body(g));
  assert.match(body(g), /"chars"/);
});

test("timeout: a call that runs too long is an error, not a hang", async () => {
  const { guarded } = await import("../src/tools.js");
  const r = await guarded(() => new Promise(() => {}), 50)({});
  assert.equal(r.isError, true);
  assert.match(r.content[0].text, /timed out/);
});

after(() => fs.rmSync(work, { recursive: true, force: true }));
