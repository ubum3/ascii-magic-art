/*
 * catalog.js: every piece an agent can name. Ours come from the library's
 * pieces/ folder; ascii.rest's come through ascii-magic-art-rest when it is
 * installed, as "rest-<name>". Sources resolve to { meta, draw(t, state) }.
 */
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { load, slugs, PIECES } from "ascii-magic-art-studio/src/load.js";
import { fromSpec } from "ascii-magic-art-extras";
import { inputPath } from "./guard.js";

const require = createRequire(import.meta.url);
export const CATEGORIES = JSON.parse(fs.readFileSync(path.join(path.dirname(require.resolve("ascii-magic-art/package.json")), "categories.json"), "utf8")).map((c) => c.id);

const REST = "rest-";
let rest;
/** The ascii.rest bridge, or null when it is not installed. Anything else wrong with it is logged and treated the same. */
export function restBridge() {
  rest ??= import("ascii-magic-art-rest").then(
    (m) => (typeof m.fromRest === "function" ? m : null),
    (e) => {
      if (e.code !== "ERR_MODULE_NOT_FOUND") console.error(`ama-mcp: ascii-magic-art-rest failed to load, using our pieces only: ${e.message}`);
      return null;
    },
  );
  return rest;
}

// The bridge's pieces as [name, restPiece]: restPieces may be a map or a list, restSlugs names them.
async function restEntries() {
  const m = await restBridge();
  if (!m) return [];
  const all = typeof m.restPieces === "function" ? await m.restPieces() : m.restPieces;
  if (!all) return [];
  if (Array.isArray(all)) return all.map((p) => [p.meta?.slug || p.meta?.name, p]).filter(([n]) => n);
  const names = typeof m.restSlugs === "function" ? await m.restSlugs() : m.restSlugs || Object.keys(all);
  return names.map((n) => [n, all[n]]).filter(([, p]) => p);
}
const restName = (n) => (n.startsWith(REST) ? n : REST + n);

let index;
/** Every piece's searchable meta, built once: ours, then the bridge's. */
export function catalog() {
  index ??= (async () => {
    const ours = await Promise.all(slugs().map(async (slug) => {
      const { meta } = await import(pathToFileURL(path.join(PIECES, slug + ".js")).href);
      return entry(slug, meta, "ascii-magic-art");
    }));
    const theirs = [];
    for (const [n, p] of await restEntries()) {
      try { theirs.push(entry(restName(n), (await (await restBridge()).fromRest(p)).meta, "ascii.rest")); }
      catch (e) { console.error(`ama-mcp: skipping rest piece ${n}: ${e.message}`); }
    }
    return [...ours, ...theirs];
  })();
  return index;
}

function entry(slug, meta, from) {
  return {
    slug, name: meta.name || slug, category: meta.category || "", note: meta.note || "", tags: meta.tags || [],
    cols: meta.cols, rows: meta.rows, fps: meta.fps, cell: meta.cell === "square" ? "square" : "text", from,
  };
}

/**
 * A slug, a "rest-" name, a path to a .json spec, .amc clip or .js piece (inside the allowed roots), or a spec object,
 * as { meta, draw, name }.
 */
export async function resolveSource(source) {
  if (source && typeof source === "object") {
    const p = fromSpec(source);
    return { meta: p.meta, draw: p.default(), name: p.meta.slug || source.kind };
  }
  if (typeof source !== "string" || !source) throw new Error("source takes a slug, a path or a spec object");
  if (/[\\/]|\.(json|amc|js|mjs)$/i.test(source)) {
    const file = inputPath(source);
    const p = await load(file);
    return { ...p, name: path.basename(file).replace(/\.[^.]+$/, "") };
  }
  if (source.startsWith(REST)) {
    const m = await restBridge();
    if (!m) throw new Error(`"${source}" is an ascii.rest piece, and ascii-magic-art-rest is not installed`);
    const found = (await restEntries()).find(([n]) => restName(n) === source);
    if (!found) throw new Error(`no ascii.rest piece called "${source}": search_pieces lists them`);
    const p = await m.fromRest(found[1]);
    return { meta: p.meta, draw: p.default(), name: source };
  }
  const p = await load(source);
  return { ...p, name: source };
}
