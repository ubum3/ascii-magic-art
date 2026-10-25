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

// The bridge's catalogue: every piece's meta without loading it.
async function restEntries() {
  const m = await restBridge();
  return m && m.REST_CATALOG ? m.REST_CATALOG : [];
}

let index;
/** Every piece's searchable meta, built once: ours, then the bridge's. */
export function catalog() {
  index ??= (async () => {
    const ours = await Promise.all(slugs().map(async (slug) => {
      const { meta } = await import(pathToFileURL(path.join(PIECES, slug + ".js")).href);
      return entry(slug, meta, "ascii-magic-art");
    }));
    const theirs = (await restEntries()).map(([slug, name, category, theirCategory, note, cols, rows, fps, square]) =>
      entry(slug, { name, category, note, tags: ["ascii.rest", theirCategory], cols, rows, fps, ...(square ? { cell: "square" } : {}) }, "ascii.rest"));
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
    if (!m.isRestSlug(source)) throw new Error(`no ascii.rest piece called "${source}": search_pieces lists them`);
    return { ...(await load(source)), name: source };
  }
  const p = await load(source);
  return { ...p, name: source };
}
