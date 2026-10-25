/*
 * source.js: what intro() takes, as { meta, draw(t, state), words, seconds }.
 * A string is a library slug when one has that name, otherwise words in the
 * extras "text" kind; { text } forces words and { slug } forces a piece.
 */
import fs from "fs";
import path from "path";
import { fromSpec, layout } from "ascii-magic-art-extras";
import { load, PIECES } from "ascii-magic-art-studio/src/load.js";

const isSlug = (s) => /^[a-z0-9-]+$/.test(s) && fs.existsSync(path.join(PIECES, s + ".js"));

// The text kind's entrance, as text.js times it, so the intro rests once it is done.
function textSeconds(spec) {
  if (spec.duration > 0) return spec.duration;
  if (spec.effect === "typewriter") return Math.max(0.6, layout(String(spec.text), spec.font === "plain" ? "plain" : "block").count * 0.09);
  return 1.6;
}

function fromText(spec) {
  spec = { kind: "text", effect: "scramble", ...spec, text: String(spec.text) };
  const p = fromSpec(spec);
  return { meta: p.meta, draw: p.default(), words: spec.text, seconds: textSeconds(spec) + 0.2 };
}

export async function resolve(src) {
  if (typeof src === "string") {
    if (isSlug(src)) {
      const p = await load(src);
      return { ...p, words: p.meta.name || src, seconds: 1.5 };
    }
    return fromText({ text: src });
  }
  if (!src || typeof src !== "object") throw new TypeError(`cli-kit: intro takes a slug, words, a spec or a piece, not ${src}`);
  if (src.meta && typeof src.default === "function") return { meta: src.meta, draw: src.default(), words: src.meta.name || src.meta.slug || "", seconds: 1.5 };
  if (src.kind === "text" || (src.text != null && !src.kind)) return fromText(src);
  if (src.kind) {
    const p = fromSpec(src);
    return { meta: p.meta, draw: p.default(), words: src.message || src.label || src.name || p.meta.name || "", seconds: src.duration > 0 ? src.duration + 0.2 : 1.5 };
  }
  if (src.slug) {
    const p = await load(src.slug);
    return { ...p, words: p.meta.name || src.slug, seconds: 1.5 };
  }
  throw new TypeError("cli-kit: a spec needs a kind, a text or a slug");
}
