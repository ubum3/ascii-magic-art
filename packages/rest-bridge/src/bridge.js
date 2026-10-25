/*
 * bridge.js: pieces of ascii.rest (https://github.com/bas3line/ascii, MIT, by
 * bas3line) as ascii-magic-art pieces, and the other way round. Pure functions,
 * no imports from ascii.rest itself, so Node, browsers, QuickJS and goja all
 * run it.
 *
 *   fromRest(restModule)   -> { meta, default() -> draw(t) }       theirs, to play here
 *   toRest(ourModule)      -> { meta, default() -> frame(t, env) } ours, for their svg()
 *
 * Their frame is one string, with each cell's colour written as a palette index
 * into env.color, a buffer the piece only writes where it draws ink. Ours is
 * { text, color }, with a palette key per cell and a space for the default ink.
 */
import { KEYS } from "ascii-magic-art/lib/kit.js";

/** Keys a converted piece may use: the effect keys (X, Y, Z) stay free, as in the extras. */
const USABLE = KEYS.slice(0, KEYS.length - 3);

/** Their categories, as ours. The original is kept in the tags. */
export const CATEGORY = {
  scenes: "landscapes", shapes: "solids", space: "cosmos", physics: "science", nature: "landscapes",
  creatures: "animals", objects: "things", generative: "algorithms", effects: "demoscene", ui: "screens",
  data: "live-data", type: "lettering", logos: "mascots", companies: "mascots", distros: "mascots",
};

/** The default ink of our players, for cells of ours with no colour key, in their palette. */
export const INK = "#e4e4e7";

const rgb = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));

/**
 * A palette folded to at most `most` colours, the two that look most alike merged
 * first, the earlier kept (as ascii.rest's svg.ts folds one). Returns the colours
 * left and each old index's new one.
 */
export function fold(palette, most) {
  const c = palette.map(rgb), into = palette.map((_, i) => i), alive = palette.map(() => true);
  const apart = (a, b) => 0.3 * (a[0] - b[0]) ** 2 + 0.59 * (a[1] - b[1]) ** 2 + 0.11 * (a[2] - b[2]) ** 2;
  for (let left = palette.length; left > most; left--) {
    let best = Infinity, keep = -1, drop = -1;
    for (let i = 0; i < palette.length; i++)
      for (let j = i + 1; j < palette.length; j++)
        if (alive[i] && alive[j] && apart(c[i], c[j]) < best) { best = apart(c[i], c[j]); keep = i; drop = j; }
    alive[drop] = false;
    for (let i = 0; i < into.length; i++) if (into[i] === drop) into[i] = keep;
  }
  const kept = palette.map((_, i) => i).filter((i) => alive[i]);
  const at = new Map(kept.map((c, k) => [c, k]));
  return { palette: kept.map((i) => palette[i]), map: into.map((i) => at.get(i)) };
}

/** "rust" or "Night Coast" to a kebab-case slug. */
const kebab = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "piece";

/**
 * One of their piece modules (`import * as rust from ".../pieces/rust.ts"`) as one
 * of ours. Drawn for a dark page (`paper: false`), as our players are. `options`
 * are the piece's own option overrides.
 */
export function fromRest(mod, { slug, paper = false, options } = {}) {
  const m = mod.meta;
  const { cols, rows } = m;
  const pal = m.palette && m.palette.length ? fold([...m.palette], USABLE.length) : null;
  const meta = {
    slug: slug || "rest-" + kebab(m.name),
    name: m.name,
    category: CATEGORY[m.category] || "things",
    note: m.note || "",
    tags: ["ascii.rest", m.category],
    cols, rows,
    fps: m.fps > 0 ? m.fps : 1,
    ...(pal ? { palette: Object.fromEntries(pal.palette.map((h, i) => [USABLE[i], h])) } : {}),
    ...(m.cell === 1 ? { cell: "square" } : {}),
    ...(m.fps > 0 ? {} : { still: true }),
    ...(m.ground ? { bg: m.ground } : {}),
    ...(m.clock ? { clock: true } : {}),
  };
  const create = () => {
    const frame = mod.default(options);
    if (!pal) return (t) => frame(t, { paper });
    // One buffer for the life of the player: their pieces write only the cells they ink.
    const buf = new Uint8Array(cols * rows), keys = pal.map.map((k) => USABLE[k]);
    return (t) => {
      const text = frame(t, { paper, color: buf });
      let color = "", i = 0;
      for (const line of text.split("\n")) {
        if (color) color += "\n";
        for (const ch of line) { color += ch === " " ? " " : keys[buf[i]] || " "; i++; }
      }
      return { text, color };
    };
  };
  return { meta, default: create };
}

/**
 * One of our piece modules as one of theirs, for svg(), banner art and the rest.
 * Every cell's index is written on every frame, since the caller keeps one buffer.
 * `state` is what a data kind draws; `seconds` becomes meta.loop, the period an
 * SVG plays.
 */
export function toRest(mod, { state, ink = INK, seconds, palette: extra } = {}) {
  const m = mod.meta;
  // Keys in KEYS order, then one more for our default ink. A frame may bring its
  // own palette (clips, sequences); pass the union of those as `palette`.
  const keyed = { ...(m.palette || {}), ...(extra || {}) };
  const keys = KEYS.split("").filter((k) => keyed[k]);
  const index = new Map(keys.map((k, i) => [k, i]));
  const palette = keys.length ? [...keys.map((k) => keyed[k]), ink] : undefined;
  const inkAt = keys.length;
  const meta = {
    name: String(m.name || m.slug).toLowerCase(),
    category: "effects",
    note: String(m.note || "").toLowerCase().slice(0, 72),
    cols: m.cols, rows: m.rows,
    fps: m.still ? 0 : m.fps,
    ...(palette ? { palette } : {}),
    ...(m.cell === "square" ? { cell: 1 } : { cell: 2 }),
    ...(seconds ? { loop: seconds } : {}),
  };
  return {
    meta,
    default() {
      const draw = mod.default();
      return (t, env = {}) => {
        const fr = draw(t, state);
        const text = typeof fr === "string" ? fr : fr.text;
        if (env.color && palette) {
          const color = typeof fr === "string" ? "" : fr.color.replace(/\n/g, "");
          for (let i = 0; i < env.color.length; i++) {
            const k = color[i];
            env.color[i] = k && k !== " " && index.has(k) ? index.get(k) : inkAt;
          }
        }
        return text;
      };
    },
  };
}

/** Every distinct colour any frame of ours brings in its own palette, at these times. */
export function framePalettes(mod, times, state) {
  const draw = mod.default(), out = {};
  for (const t of times) {
    const fr = draw(t, state);
    if (fr && typeof fr === "object" && fr.palette) Object.assign(out, fr.palette);
  }
  return out;
}
