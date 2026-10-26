#!/usr/bin/env node
/*
 * bundle-native.mjs: package every piece for the terminal libraries, which run
 * the pieces in an embedded JS engine (QuickJS in Rust, goja in Go).
 *
 *   node scripts/bundle-native.mjs
 *
 * Writes:
 *   packages/ratatui/assets/pieces.bin, packages/bubbletea/pieces.bin
 *       "AMA1", u32 LE index length, the JSON index, then raw-deflate blobs:
 *       the prelude (kit + image + glyphs, as a script that defines __ama) and
 *       one script per piece that calls __ama.define(slug, fn(module, exports, require)).
 *   packages/ratatui/src/catalog.rs, packages/bubbletea/slug/slug.go
 *       every slug as a constant, so names complete in your editor.
 *   packages/fixtures/golden.bin
 *       deflated JSON { slug: [text, color] }: each piece drawn by Node at
 *       t = 0, 0.5, 1.5 (the last kept), for the engine parity tests.
 *   packages/fixtures/extras-golden.bin
 *       deflated JSON { name: { spec, state, frame: [text, color] } }: the
 *       packages/extras fixtures drawn by Node, for the extras parity tests.
 *
 * The bundle also carries packages/extras (pieces made from JSON specs: logos,
 * text, data, pictures) as one more blob, which an engine loads only for specs.
 *
 * Pieces are lowered to ES2017 and CommonJS by esbuild, which both engines run.
 * With an ascii.rest checkout at ./ascii, its 240 pieces come too, as
 * "rest-<name>", each wrapped in packages/rest-bridge's fromRest, and their
 * frames go to packages/fixtures/rest-golden.bin (golden.bin keeps ours only).
 *
 * Run it again after pulling upstream pieces or adding your own.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { fileURLToPath, pathToFileURL } from "url";
import * as esbuild from "esbuild";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "pieces");
const TARGET = "es2017";

// The prelude: the kit, the picture helper and the looks, plus the host API.
const PRELUDE = `
import * as kit from "./lib/kit.js";
import * as image from "./lib/image.js";
import { withLook, restyle } from "./runtime/glyphs.js";
import { fromRest } from "./packages/rest-bridge/src/bridge.js";
// QuickJS and goja have no Intl: QuickJS ignores "en-US" and drops the thousands
// separators that ledger and leaderboard pieces show, and goja takes it for a radix
// and throws. Same rules as Intl: up to 3 decimals, at least minimumFractionDigits.
const hasIntl = () => { try { return (1234.5).toLocaleString("en-US") === "1,234.5"; } catch (e) { return false; } };
if (!hasIntl()) {
  Number.prototype.toLocaleString = function (locales, o) {
    const x = Number(this);
    if (!isFinite(x)) return String(x);
    const mn = (o && o.minimumFractionDigits) || 0;
    const mx = Math.max(mn, o && o.maximumFractionDigits != null ? o.maximumFractionDigits : 3);
    const s = Math.abs(x).toFixed(mx);
    let [i, f = ""] = s.split(".");
    while (f.length > mn && f.endsWith("0")) f = f.slice(0, -1);
    i = i.replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");
    return (x < 0 && Number(s) !== 0 ? "-" : "") + i + (f ? "." + f : "");
  };
}
const defs = {}, mods = {}, handles = [];
const require = (p) => {
  if (p === "../lib/kit.js") return kit;
  if (p === "../lib/image.js") return image;
  throw new Error("pieces can only import ../lib/kit.js and ../lib/image.js, not " + p);
};
const load = (slug) => {
  if (mods[slug]) return mods[slug];
  const fn = defs[slug];
  if (!fn) throw new Error("no piece " + slug);
  const module = { exports: {} };
  fn(module, module.exports, require);
  return (mods[slug] = module.exports);
};
globalThis.__ama = {
  define(slug, fn) { defs[slug] = fn; },
  // ascii.rest pieces are defined through this: their module, as one of ours.
  fromRest,
  // A player for a piece in a look (JSON of the runtime's look options, or "").
  make(slug, look) {
    const m = load(slug);
    const draw = withLook(m.default(), m.meta.palette, look ? JSON.parse(look) : null);
    handles.push({ draw, pal: null });
    return handles.length - 1;
  },
  // A player for an extras spec (JSON), in a look. Needs the extras blob loaded.
  makeSpec(spec, look) {
    const p = globalThis.__ama.extras.make(JSON.parse(spec)), d = p.create();
    const o = look ? JSON.parse(look) : null;
    const on = o && (o.chars || (o.look && o.look !== "original") || o.mono);
    handles.push({ draw: on ? (t, s) => restyle(d(t, s), p.meta.palette, o) : d, pal: null, meta: p.meta, state: undefined });
    return handles.length - 1;
  },
  // A spec player's meta, as JSON.
  meta(h) { return JSON.stringify(handles[h].meta); },
  // The state a data spec draws (JSON), passed with every frame from now on.
  setState(h, state) { handles[h].state = state ? JSON.parse(state) : undefined; },
  // Pixels to an image spec: rgba is a string with one character per byte.
  imageSpec(rgba, w, h, opts) {
    const px = new Uint8Array(rgba.length);
    for (let i = 0; i < rgba.length; i++) px[i] = rgba.charCodeAt(i);
    const o = opts ? JSON.parse(opts) : {};
    const cells = globalThis.__ama.extras.cellsFromPixels(px, w, h, o);
    return JSON.stringify(Object.assign({ kind: "image", square: o.square !== false }, cells, o.motion ? { motion: o.motion } : {}));
  },
  // One frame as "text\\0color\\0palette". color is empty for a plain frame; palette is
  // JSON only when a look brought its own (brightened) palette and it changed.
  draw(h, t) {
    const H = handles[h], f = H.draw(t, H.state);
    if (typeof f === "string") return f + "\\0\\0";
    let p = "";
    if (f.palette && f.palette !== H.pal) { H.pal = f.palette; p = JSON.stringify(f.palette); }
    return f.text + "\\0" + f.color + "\\0" + p;
  },
  drop(h) { handles[h] = null; },
};
`;

const prelude = (await esbuild.build({
  stdin: { contents: PRELUDE, resolveDir: ROOT, loader: "js" },
  bundle: true, write: false, format: "iife", target: TARGET, minify: true, legalComments: "none",
})).outputFiles[0].text;

// The extras, as a script that hangs them on __ama.extras.
const extras = (await esbuild.build({
  stdin: { contents: `import * as x from "./packages/extras/src/index.js"; globalThis.__ama.extras = x;`, resolveDir: ROOT, loader: "js" },
  bundle: true, write: false, format: "iife", target: TARGET, minify: true, legalComments: "none",
})).outputFiles[0].text;

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".js")).sort();
const IMPORT = /^import\s*\{[^}]*\}\s*from\s*"\.\.\/lib\/(kit|image)\.js";?\s*$/gm;
const blobs = [], pieces = [], golden = {}, problems = [];
let offset = 0;
const push = (src) => {
  const z = zlib.deflateRawSync(Buffer.from(src, "utf8"), { level: 9 });
  blobs.push(z);
  const at = [offset, z.length];
  offset += z.length;
  return at;
};
const preludeAt = push(prelude);
const extrasAt = push(extras);

for (const f of files) {
  const slug = f.slice(0, -3);
  const src = fs.readFileSync(path.join(DIR, f), "utf8");
  // Only the shapes the prelude's require() knows about.
  const imports = src.match(/^import .*$/gm) || [];
  if (imports.length !== (src.match(IMPORT) || []).length) problems.push(`${slug}: imports something other than ../lib/kit.js or ../lib/image.js`);
  if (!/^export const meta\b/m.test(src)) problems.push(`${slug}: no "export const meta"`);
  if (!/^export default\b/m.test(src)) problems.push(`${slug}: no default export`);

  const mod = await import(pathToFileURL(path.join(DIR, f)).href);
  const m = mod.meta;
  const cjs = (await esbuild.transform(src, { format: "cjs", target: TARGET, loader: "js", minifyWhitespace: true, legalComments: "none" })).code;
  const [off, len] = push(`__ama.define(${JSON.stringify(slug)},function(module,exports,require){${cjs}\n});`);
  pieces.push({
    slug, name: m.name, category: m.category, note: m.note || "", tags: m.tags || [],
    cols: m.cols, rows: m.rows, fps: m.fps, square: m.cell === "square",
    palette: m.palette || null, clock: /\bnew Date\b|\bDate\.now\b/.test(src), off, len,
  });

  const draw = mod.default();
  let fr;
  for (const t of [0, 0.5, 1.5]) fr = draw(t);
  golden[slug] = typeof fr === "string" ? [fr, ""] : [fr.text, fr.color];
}
// ascii.rest's pieces, when there is a checkout. Their only imports are types.
const REST = path.join(ROOT, "ascii/src/pieces");
const restGolden = {};
if (fs.existsSync(REST)) {
  const rest = await import(pathToFileURL(path.join(ROOT, "packages/rest-bridge/src/index.js")).href);
  for (const name of rest.restNames) {
    const slug = "rest-" + name;
    const src = fs.readFileSync(path.join(REST, name + ".ts"), "utf8");
    if ((src.match(/^import (?!type\b).*$/gm) || []).length) problems.push(`${slug}: imports more than types`);
    const cjs = (await esbuild.transform(src, { format: "cjs", target: TARGET, loader: "ts", minifyWhitespace: true, legalComments: "none" })).code;
    const [off, len] = push(`__ama.define(${JSON.stringify(slug)},function(module,exports,require){var m={exports:{}};(function(module,exports){${cjs}\n})(m,m.exports);var p=__ama.fromRest(m.exports,{slug:${JSON.stringify(slug)}});exports.meta=p.meta;exports.default=p.default;});`);
    const p = await rest.restPiece(slug);
    const m = p.meta;
    const clock = !!m.clock || /\bnew Date\b|\bDate\.now\b/.test(src);
    pieces.push({
      slug, name: m.name, category: m.category, note: m.note || "", tags: m.tags || [],
      cols: m.cols, rows: m.rows, fps: m.fps, square: m.cell === "square",
      palette: m.palette || null, clock, off, len,
    });
    if (clock) continue;
    const draw = p.default();
    let fr;
    for (const t of [0, 0.5, 1.5]) fr = draw(t);
    restGolden[slug] = typeof fr === "string" ? [fr, ""] : [fr.text, fr.color];
  }
} else {
  console.log("no ascii.rest checkout at ./ascii (restore it from ubum3/ascii): its pieces are left out");
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

const index = Buffer.from(JSON.stringify({ version: 1, prelude: preludeAt, extras: extrasAt, pieces }), "utf8");
const head = Buffer.alloc(8);
head.write("AMA1", 0, "latin1");
head.writeUInt32LE(index.length, 4);
const bin = Buffer.concat([head, index, ...blobs]);

const out = (rel, data) => {
  const p = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, data);
  console.log(`${rel}  ${(data.length / 1024).toFixed(0)} KB`);
};
out("packages/ratatui/assets/pieces.bin", bin);
out("packages/bubbletea/pieces.bin", bin);
out("packages/fixtures/golden.bin", zlib.deflateRawSync(Buffer.from(JSON.stringify(golden)), { level: 9 }));
if (Object.keys(restGolden).length) out("packages/fixtures/rest-golden.bin", zlib.deflateRawSync(Buffer.from(JSON.stringify(restGolden)), { level: 9 }));

// The extras fixtures, drawn by Node at the same times the parity tests use.
const fx = await import(pathToFileURL(path.join(ROOT, "packages/extras/test/fixtures.js")).href);
const { fromSpec } = await import(pathToFileURL(path.join(ROOT, "packages/extras/src/index.js")).href);
const extrasGolden = {};
for (const [name, spec, state] of fx.fixtures()) {
  const draw = fromSpec(spec).default();
  let fr;
  for (const t of fx.TIMES) fr = draw(t, state);
  extrasGolden[name] = { spec, state: state ?? null, times: fx.TIMES, frame: typeof fr === "string" ? [fr, ""] : [fr.text, fr.color] };
}
out("packages/fixtures/extras-golden.bin", zlib.deflateRawSync(Buffer.from(JSON.stringify(extrasGolden)), { level: 9 }));

// Slug constants. Identifiers can't start with a digit, so those get a prefix.
const words = (s) => s.split("-");
const rustId = (s) => (/^\d/.test(s) ? "P_" : "") + s.toUpperCase().replace(/-/g, "_");
const goId = (s) => (/^\d/.test(s) ? "P" : "") + words(s).map((w) => w[0].toUpperCase() + w.slice(1)).join("");
const GEN = "Generated by scripts/bundle-native.mjs. Do not edit.";
out("packages/ratatui/src/catalog.rs", Buffer.from(
  `// ${GEN}\n\n//! Every piece's slug as a constant: \`slug::MATRIX_RAIN\`.\n\n` +
  `/// Every slug, sorted.\npub const SLUGS: &[&str] = &[\n${pieces.map((p) => `    "${p.slug}",`).join("\n")}\n];\n\n` +
  `/// Slug constants, one per piece.\npub mod slug {\n${pieces.map((p) => `    /// ${p.name}: ${p.note.replace(/\s+/g, " ")}\n    pub const ${rustId(p.slug)}: &str = "${p.slug}";`).join("\n")}\n}\n`));
out("packages/bubbletea/slug/slug.go", Buffer.from(
  `// Code generated by scripts/bundle-native.mjs. DO NOT EDIT.\n\n// Package slug names every piece, so slugs complete in your editor: slug.MatrixRain.\npackage slug\n\n` +
  `const (\n${pieces.map((p) => `\t// ${goId(p.slug)} is ${p.name}: ${p.note.replace(/\s+/g, " ")}\n\t${goId(p.slug)} = "${p.slug}"`).join("\n")}\n)\n\n` +
  `// All is every slug, sorted.\nvar All = []string{\n${pieces.map((p) => `\t"${p.slug}",`).join("\n")}\n}\n`));
console.log(`${pieces.length} pieces, prelude ${(prelude.length / 1024).toFixed(0)} KB, extras ${(extras.length / 1024).toFixed(0)} KB`);
