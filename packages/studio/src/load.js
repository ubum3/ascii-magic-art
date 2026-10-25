/*
 * load.js: anything playable, by name or path: a library slug, an ascii.rest
 * piece (rest-rust), a spec (.json), a clip (.amc) or a piece module (.js).
 * Returns { meta, draw(t, state), create(), kind }: create() makes a fresh draw.
 */
import fs from "fs";
import path from "path";
import zlib from "zlib";
import { createRequire } from "module";
import { pathToFileURL } from "url";
import { withLook } from "ascii-magic-art/runtime/glyphs.js";
import { fromSpec, decodeClip, clipPiece } from "ascii-magic-art-extras";

const require = createRequire(import.meta.url);
export const PIECES = path.join(path.dirname(require.resolve("ascii-magic-art/package.json")), "pieces");
export const slugs = () => fs.readdirSync(PIECES).filter((f) => f.endsWith(".js")).map((f) => f.slice(0, -3)).sort();

const lookOn = (look) => look && (look.chars || (look.look && look.look !== "original") || look.mono);

function closest(name, list) {
  const d = (a, b) => {
    const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  };
  return list.map((s) => [d(name, s), s]).sort((a, b) => a[0] - b[0]).slice(0, 3).map((x) => x[1]);
}

const piece = (mod, look, kind) => {
  const create = () => withLook(mod.default(), mod.meta.palette, lookOn(look) ? look : null);
  return { meta: mod.meta, draw: create(), create, kind };
};

export async function load(src, look = {}) {
  if (src && typeof src === "object") return wrap(fromSpec(src, lookOn(look) ? look : undefined), "spec", src);
  const ext = path.extname(src).toLowerCase();
  if (ext === ".amc") {
    const clip = decodeClip(fs.readFileSync(src), (u) => zlib.inflateRawSync(u));
    return { ...piece(clipPiece(clip), look, "clip"), clip };
  }
  if (ext === ".json") {
    const spec = JSON.parse(fs.readFileSync(src, "utf8"));
    return wrap(fromSpec(spec, lookOn(look) ? look : undefined), "spec", spec);
  }
  if (ext === ".js" || ext === ".mjs") return piece(await import(pathToFileURL(path.resolve(src)).href), look, "piece");
  if (/^rest[-:]/.test(src)) {
    const rest = await import("ascii-magic-art-rest");
    const slug = "rest-" + src.slice(5);
    if (!rest.isRestSlug(slug)) {
      throw new Error(`no ascii.rest piece called "${src.slice(5)}". Did you mean: ${closest(slug, rest.restSlugs).join(", ")}?`);
    }
    return piece(await rest.restPiece(slug), look, "rest");
  }
  if (!fs.existsSync(path.join(PIECES, src + ".js"))) {
    throw new Error(`no piece, spec or clip called "${src}". Did you mean: ${closest(src, slugs()).join(", ")}?`);
  }
  return piece(await import(pathToFileURL(path.join(PIECES, src + ".js")).href), look, "piece");
}

function wrap(p, kind, spec) {
  return { meta: p.meta, draw: p.default(), create: p.default, kind, spec };
}
