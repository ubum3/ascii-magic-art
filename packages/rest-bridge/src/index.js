/*
 * ascii-magic-art-rest: ascii.rest (https://github.com/bas3line/ascii, MIT, by
 * bas3line) for ascii-magic-art. Its 240 pieces as ours, under "rest-<name>",
 * and its animated SVGs, banners and logo glyphs for ours.
 *
 *   const rust = await restPiece("rest-rust");        // a piece module of ours
 *   svg(toRest(ourPiece, { seconds: 4 }), { dark: true });
 *
 * This file imports ascii.rest's TypeScript from ../../../ascii (a checkout next
 * to the packages). Node 22.18+ runs that as is; scripts/build.mjs bundles it to
 * dist/ for everything else.
 */
import { load } from "../../../ascii/src/library.ts";
import { fromRest } from "./bridge.js";

export * from "./bridge.js";
export { svg, bannerSvg } from "../../../ascii/src/svg.ts";
export { banner, fonts, shadows } from "../../../ascii/src/banner.ts";
export { drawing, fromPixels } from "../../../ascii/src/kit/image.ts";

/** Their file names, which are also their slugs here after "rest-". */
export const restNames = Object.keys(load);
/** Every slug: "rest-rust", "rest-night-coast", ... */
export const restSlugs = restNames.map((n) => "rest-" + n);

/** Whether a slug is one of theirs. */
export const isRestSlug = (s) => typeof s === "string" && s.startsWith("rest-") && Object.hasOwn(load, s.slice(5));

/** Their raw module, by our slug or their name. */
export async function restModule(slug) {
  const name = slug.startsWith("rest-") ? slug.slice(5) : slug;
  if (!Object.hasOwn(load, name)) throw new Error(`no ascii.rest piece called "${name}"`);
  return load[name]();
}

/** One of their pieces as a piece module of ours. */
export async function restPiece(slug, opts = {}) {
  const name = slug.startsWith("rest-") ? slug.slice(5) : slug;
  return fromRest(await restModule(name), { ...opts, slug: "rest-" + name });
}

export { REST_CATALOG } from "./catalog.js";
import { REST_CATALOG } from "./catalog.js";
const BY_SLUG = new Map(REST_CATALOG.map((r) => [r[0], r]));
/** A piece's size without loading it, as the React player lays out its box. */
export function restSize(slug) {
  const r = BY_SLUG.get(slug.startsWith("rest-") ? slug : "rest-" + slug);
  return r && { cols: r[5], rows: r[6], square: r[8] === 1 };
}

/** Every piece, each loaded when asked for: { "rest-rust": () => Promise<module> }. */
export const restPieces = Object.fromEntries(restNames.map((n) => ["rest-" + n, () => restPiece(n)]));
