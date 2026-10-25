/*
 * util.js: small shared helpers for the extras. Everything here is deterministic
 * (no Math.random, no clock), so Node, QuickJS and goja draw the same frames.
 */
import { KEYS } from "ascii-magic-art/lib/kit.js";

/** A hash of up to three integers, in 0..1. */
export function hash(x, y = 0, n = 0) {
  let h = (x * 374761393 + y * 668265263 + n * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const easeOut = (t) => 1 - Math.pow(1 - Math.max(0, Math.min(1, t)), 3);
export const easeInOut = (t) => { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

export const toRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
export const toHex = (c) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** Mix two hex colours: 0 is a, 1 is b. */
export const mix = (a, b, k) => { const x = toRgb(a), y = toRgb(b); return toHex(x.map((v, i) => v + (y[i] - v) * k)); };
export const luma = (h) => { const [r, g, b] = toRgb(h); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

/**
 * Keys the effects keep for their own colours, at the end of the key list, so a
 * picture or logo can use the first 59 for itself.
 */
export const FX = { accent: "X", dim: "Y", extra: "Z" };
export const PICTURE_KEYS = KEYS.slice(0, KEYS.length - 3);

/** Lower block glyphs whose ink grows in eighths, as lib/image.js draws them. */
export const LEVELS = "▁▂▃▄▅▆▇█";
/** Coverage (0..8) to a shading block, for logos and masks. */
export const COVER = " ░░▒▒▓▓██";

/** Rows of characters to a text layer. */
export const join = (rows) => rows.map((r) => r.join("")).join("\n");

/** A blank cols x rows layer pair. */
export function layers(cols, rows) {
  return {
    T: Array.from({ length: rows }, () => new Array(cols).fill(" ")),
    C: Array.from({ length: rows }, () => new Array(cols).fill(" ")),
  };
}

/** Defaults for the meta a spec turns into. */
export function metaFor(spec, extra) {
  return {
    slug: spec.slug || spec.kind, name: spec.name || spec.slug || spec.kind, category: "extras",
    note: spec.note || "", tags: ["extras", spec.kind], fps: spec.fps || 24, ...extra,
  };
}
