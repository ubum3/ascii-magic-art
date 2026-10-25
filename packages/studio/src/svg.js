/*
 * svg.js: any playable thing as an animated SVG, for a README, docs or an <img>,
 * where no script runs. The frames go through ascii.rest's svg() (MIT, by
 * bas3line), via ascii-magic-art-rest's toRest.
 *
 *   dark   for a dark page: no background, our colours as drawn (the default)
 *   light  for a light page: a coloured piece on its own dark card, since its
 *          colours are made for a dark ground; a one-ink piece in dark ink
 *   both   x.svg (light) and x.dark.svg, and the <picture> that picks one
 *
 * An SVG plays one loop. Unless --seconds says how long, it looks for a period
 * the piece repeats at; a spec with an entrance (a logo, text) plays it once and
 * holds the last frame; anything else loops 4 seconds, with a warning that the
 * loop jumps.
 */
import fs from "fs";
import path from "path";
import { svg, toRest, framePalettes } from "ascii-magic-art-rest";

const CARD = "#09090b";
const PERIODS = [2, 3, 4, 6, 8, 12];

const same = (a, b) => (typeof a === "string" ? a : a.text + a.color) === (typeof b === "string" ? b : b.text + b.color);

/** The shortest period a piece repeats at, from PERIODS, or 0. */
export function periodOf(create, state) {
  const d = create();
  const at = (t) => d(t, state);
  return PERIODS.find((p) => [0, 0.5, 1.25].every((t) => same(at(t), at(t + p)))) || 0;
}

/** How long one loop of the SVG is, and whether it plays once. */
function loopFor(src, o, warn) {
  if (src.meta.still) return { seconds: 0, once: false };
  // The CLI always passes an export length; svgSeconds is the one the user asked for.
  const asked = "svgSeconds" in o ? o.svgSeconds : o.seconds;
  if (asked) return { seconds: asked, once: !!o.once };
  const create = src.create || (() => src.draw);
  const p = periodOf(create, o.state);
  if (p) return { seconds: p, once: false };
  if (src.kind === "spec" && src.spec && ["brand", "text", "celebrate"].includes(src.spec.kind) && !src.spec.loop) {
    return { seconds: (src.spec.duration || 2.2) + 1.5, once: true };
  }
  warn(`no period found for ${src.meta.slug || src.meta.name}: the SVG loops 4 s and jumps back. --seconds N sets the loop.`);
  return { seconds: 4, once: false };
}

/** The SVG text, for a dark page or a light one. */
export function svgText(src, o = {}, warn = console.warn) {
  const create = src.create || (() => src.draw);
  const { seconds, once } = loopFor(src, o, warn);
  const fps = Math.min(o.fps || 15, src.meta.fps || 15);
  const times = Array.from({ length: Math.max(1, Math.round(seconds * fps)) }, (_, i) => i / fps);
  const mod = { meta: src.meta, default: create };
  const piece = toRest(mod, { state: o.state, seconds: seconds || undefined, palette: framePalettes(mod, times, o.state) });
  const dark = !o.light;
  if (!dark && piece.meta.palette) piece.meta.ground = o.bg || CARD;
  else if (o.bg) piece.meta.ground = o.bg;
  const warnings = [];
  const keep = console.warn;
  console.warn = (...a) => warnings.push(a.join(" "));
  try {
    return svg(piece, { dark, fps, seconds: seconds || undefined, once, label: src.meta.name, ...(o.scale ? { scale: o.scale } : {}), ...(o.budget != null ? { budget: o.budget } : {}) });
  } finally {
    console.warn = keep;
    for (const w of warnings) warn(w);
  }
}

/**
 * Writes `file`; with `both`, also its .dark.svg twin, and returns the <picture>
 * snippet for a README.
 */
export function toSvg(src, file, o = {}) {
  if (!o.both) { fs.writeFileSync(file, svgText(src, o)); return { files: [file] }; }
  const dark = file.replace(/(\.dark)?\.svg$/i, ".dark.svg"), light = file.replace(/(\.dark)?\.svg$/i, ".svg");
  fs.writeFileSync(light, svgText(src, { ...o, light: true }));
  fs.writeFileSync(dark, svgText(src, { ...o, light: false }, () => {}));
  const name = (f) => path.basename(f);
  const alt = String(src.meta.name || "").replace(/"/g, "&quot;");
  const snippet = [
    "<picture>",
    `  <source media="(prefers-color-scheme: dark)" srcset="${name(dark)}">`,
    `  <img alt="${alt}" src="${name(light)}">`,
    "</picture>",
  ].join("\n");
  return { files: [light, dark], snippet };
}
