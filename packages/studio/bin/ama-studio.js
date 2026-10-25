#!/usr/bin/env node
/*
 * ama-studio: make animated ASCII art from your own pictures, videos, logos and
 * words, and export any piece to a cast, GIF, video or image.
 *
 *   ama-studio convert photo.jpg                     play it in the terminal
 *   ama-studio convert photo.jpg -o photo.json       a spec, for React, Rust and Go
 *   ama-studio convert clip.mp4 -o clip.amc          a clip (video, GIF)
 *   ama-studio convert clip.mp4 -o clip.gif          straight to a GIF
 *   ama-studio brand logo.svg --effect assemble -o logo.json
 *   ama-studio text "DEPLOYED" --effect scramble -o deployed.cast
 *   ama-studio play matrix-rain | logo.json | clip.amc | piece.js
 *   ama-studio export moonlit-sea -o moonlit.mp4 --seconds 8
 *   ama-studio export logo.json -o logo.svg --both    animated SVGs for a README
 *   ama-studio banner "ACME" --font slim --tagline "payments" -o banner.svg
 *   ama-studio play rest-rust                         an ascii.rest piece
 *
 * Outputs by extension: .json (spec), .js (piece module), .amc (clip),
 * .cast, .png, .gif, .mp4, .webm, .svg. Without -o, it plays in the terminal.
 */
import fs from "fs";
import path from "path";
import { parseArgs } from "util";
import { BRAND_EFFECTS, BRAND_IDLES, TEXT_EFFECTS } from "ascii-magic-art-extras";
import { LOOKS } from "ascii-magic-art/runtime/glyphs.js";
import { load } from "../src/load.js";
import { imageSpec, brandSpec } from "../src/raster.js";
import { videoClip } from "../src/video.js";
import { exportTo, FORMATS } from "../src/export.js";
import { play } from "../src/play.js";
import { pieceModule } from "../src/piecejs.js";

const HELP = `ama-studio: animated ASCII art from your pictures, videos, logos and words.

  convert <image|gif|video>   a picture becomes a moving piece, a video a clip
  brand   <logo.svg|png>      a logo with an entrance effect
  text    "<words>"           words in a block font, with an effect
  banner  "<words>"           words in ascii.rest's banner fonts, with a glint
  play    <slug|file>         play a piece, spec, clip or piece module
  export  <slug|file> -o out  write a cast, PNG, GIF, MP4, WebM or SVG

A slug is one of the library's pieces (matrix-rain) or ascii.rest's (rest-rust).

Output (-o) by extension: .json spec, .js piece module, .amc clip, ${FORMATS.map((f) => "." + f).join(", ")}.
Without -o, it plays in the terminal (any key stops it).

Options
  --cols N --rows N      size in cells (default: 96 square pixels for pictures, 80 for video, 60 for logos)
  --square / --text      square pixel cells (half blocks in a terminal) or text cells
  --colors N | "#a,#b"   palette size for pictures; replacement colours for a logo
  --look NAME            ${Object.keys(LOOKS).join(", ")}
  --chars " .oO@"        your own characters instead of a look
  --motion LIST          pictures: glint,breathe=0.3,water=0.6,twinkle=0.5,drift=0.3,birds=5,shooting
  --effect NAME          brand: ${BRAND_EFFECTS.join(", ")}
                         text:  ${TEXT_EFFECTS.join(", ")}
  --idle NAME            brand: ${BRAND_IDLES.join(", ")}
  --duration S --loop S  entrance length; replay every S seconds
  --font block|plain     text font
  --fps N --seconds S --start S   video sampling, and export/play length
  --state JSON           state for data pieces (progress, sparkline, ticker, celebrate)
  --px N --width N --height N --preset NAME --bg #hex   image and video export size
  --at S                 the time of the frame a PNG shows
  --frame                print one frame and exit
  --style blocks|glyphs  brand: shaded blocks, or characters shaped like the logo's edges
  --dark --light --both  SVG: for a dark page (default), a light one, or both and a <picture>
  --format NAME          export format, when -o has no telling extension
  banner: --font ${"NAME"} --shadow NAME --fill CHAR --tagline TEXT --art SLUG --place left|right|above|below
          --effect glint|type|still --colors "#a,#b"
`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o" }, cols: { type: "string" }, rows: { type: "string" },
    square: { type: "boolean" }, text: { type: "boolean" }, colors: { type: "string" }, look: { type: "string" },
    chars: { type: "string" }, mono: { type: "boolean" }, motion: { type: "string" }, effect: { type: "string" },
    idle: { type: "string" }, duration: { type: "string" }, loop: { type: "string" }, font: { type: "string" },
    fps: { type: "string" }, seconds: { type: "string" }, start: { type: "string" }, state: { type: "string" },
    px: { type: "string" }, width: { type: "string" }, height: { type: "string" }, preset: { type: "string" },
    bg: { type: "string" }, at: { type: "string" }, frame: { type: "boolean" }, name: { type: "string" },
    accent: { type: "string" }, shadow: { type: "string" }, style: { type: "string" }, dark: { type: "boolean" },
    light: { type: "boolean" }, both: { type: "boolean" }, format: { type: "string" }, fill: { type: "string" },
    tagline: { type: "string" }, art: { type: "string" }, place: { type: "string" }, "no-shadow": { type: "boolean" }, help: { type: "boolean", short: "h" },
  },
});

const num = (v) => (v == null ? undefined : Number(v));
const fail = (msg) => { console.error(`ama-studio: ${msg}`); process.exit(1); };
const [cmd, input, ...rest] = positionals;
if (o.help || !cmd) { process.stdout.write(HELP); process.exit(cmd || o.help ? 0 : 1); }

if (o.look && !LOOKS[o.look]) fail(`no look "${o.look}": ${Object.keys(LOOKS).join(", ")}`);
const look = o.look || o.chars || o.mono ? { look: o.look, chars: o.chars, mono: !!o.mono } : undefined;
const state = o.state ? JSON.parse(o.state) : undefined;
const playOpts = { seconds: num(o.seconds), state, frame: !!o.frame, at: num(o.at) ?? 1.5 };
const exportOpts = {
  format: o.format, dark: !!o.dark, light: !!o.light, both: !!o.both, onSnippet: (s) => console.log(`README:\n${s}`),
  svgSeconds: num(o.seconds), seconds: num(o.seconds) ?? 6, fps: num(o.fps), state, px: num(o.px), width: num(o.width), height: num(o.height), preset: o.preset, bg: o.bg, at: num(o.at), look };

function parseMotion(s) {
  if (!s) return undefined;
  const m = {};
  for (const part of s.split(",")) {
    const [k, v] = part.split("=");
    m[k.trim()] = v == null ? true : Number(v);
  }
  return m;
}
const colorList = (s) => (s && s.includes("#") ? s.split(",").map((x) => x.trim()) : undefined);
const VIDEO = /\.(gif|mp4|mov|webm|mkv|avi|m4v|mpg|mpeg)$/i;

/**
 * What to export. A cast is text, so the look is applied to the frames; images and
 * videos get it from runtime/canvas.js, which also draws the shape looks (dots...).
 */
const source = (src, out) => load(src, /\.cast$/i.test(out) ? look || {} : {});

/** Write a spec or play it; the output format comes from -o. */
async function finish(spec, what) {
  const out = o.out;
  if (!out) return play(await load(spec, look || {}), playOpts);
  const ext = path.extname(out).toLowerCase().slice(1);
  if (ext === "json") { fs.writeFileSync(out, JSON.stringify(spec)); return done(out, what); }
  if (ext === "js" || ext === "mjs") { fs.writeFileSync(out, await pieceModule(spec)); return done(out, what); }
  if (ext === "amc") fail("an .amc clip comes from a video or GIF; use .json for a picture");
  await exportTo(await source(spec, out), out, exportOpts);
  done(out, what);
}
function done(file, what) {
  const kb = (fs.statSync(file).size / 1024).toFixed(0);
  console.log(`${what} -> ${file} (${kb} KB)`);
}

try {
  switch (cmd) {
    case "convert": {
      if (!input) fail("convert what? ama-studio convert <image|gif|video>");
      if (!fs.existsSync(input)) fail(`no file ${input}`);
      const square = o.text ? false : o.square ?? !look;
      if (VIDEO.test(input) && !/\.json$/i.test(o.out || "")) {
        const fps = num(o.fps) ?? 12;
        const clip = videoClip(input, {
          cols: num(o.cols) ?? 80, rows: num(o.rows), square, fps, seconds: num(o.seconds) ?? 10, start: num(o.start),
          colors: num(o.colors) ?? 48, look, name: o.name || path.basename(input).replace(/\.[^.]+$/, ""),
        });
        const mb = clip.bytes.length / 1048576;
        if (mb > 5) console.warn(`warning: the clip is ${mb.toFixed(1)} MB. Fewer --cols, --fps or --seconds make it smaller.`);
        const out = o.out;
        if (out && out.endsWith(".amc")) { fs.writeFileSync(out, clip.bytes); done(out, `${clip.frames.length} frames, ${clip.header.cols}x${clip.header.rows}`); break; }
        const tmp = path.join(fs.mkdtempSync(path.join((await import("os")).tmpdir(), "ama-")), "clip.amc");
        fs.writeFileSync(tmp, clip.bytes);
        const src = await load(tmp);
        if (!out) { await play(src, playOpts); break; }
        await exportTo(src, out, { ...exportOpts, seconds: num(o.seconds) ?? clip.frames.length / fps, look: undefined });
        done(out, `${clip.frames.length} frames`);
        break;
      }
      const spec = await imageSpec(input, {
        cols: num(o.cols) ?? (square ? 96 : 100), rows: num(o.rows), square, colors: num(o.colors) ?? 48,
        motion: parseMotion(o.motion), look: o.look, name: o.name || path.basename(input).replace(/\.[^.]+$/, ""),
      });
      await finish(spec, `${spec.cols}x${spec.rows} picture`);
      break;
    }
    case "brand": {
      if (!input) fail("brand what? ama-studio brand <logo.svg>");
      if (!fs.existsSync(input)) fail(`no file ${input}`);
      if (o.effect && !BRAND_EFFECTS.includes(o.effect)) fail(`no effect "${o.effect}": ${BRAND_EFFECTS.join(", ")}`);
      if (o.idle && !BRAND_IDLES.includes(o.idle)) fail(`no idle "${o.idle}": ${BRAND_IDLES.join(", ")}`);
      const spec = await brandSpec(input, {
        cols: num(o.cols) ?? 60, rows: num(o.rows), square: !!o.square, effect: o.effect || "reveal", idle: o.idle, style: o.style,
        duration: num(o.duration), loop: num(o.loop), colors: colorList(o.colors), look: o.look,
        name: o.name || path.basename(input).replace(/\.[^.]+$/, ""),
      });
      if (o.accent) spec.accent = o.accent;
      await finish(spec, `${spec.cols}x${spec.rows} ${spec.effect}`);
      break;
    }
    case "text": {
      const words = [input, ...rest].filter(Boolean).join(" ");
      if (!words) fail('text what? ama-studio text "DEPLOYED"');
      if (o.effect && !TEXT_EFFECTS.includes(o.effect)) fail(`no effect "${o.effect}": ${TEXT_EFFECTS.join(", ")}`);
      const spec = {
        kind: "text", text: words, effect: o.effect || "scramble", font: o.font === "plain" ? "plain" : "block",
        ...(colorList(o.colors) ? { colors: colorList(o.colors) } : {}), ...(o["no-shadow"] ? { shadow: false } : {}),
        ...(num(o.duration) ? { duration: num(o.duration) } : {}), ...(num(o.loop) ? { loop: num(o.loop) } : {}),
        ...(num(o.cols) ? { cols: num(o.cols) } : {}), ...(num(o.rows) ? { rows: num(o.rows) } : {}),
      };
      await finish(spec, `"${words}" ${spec.effect}`);
      break;
    }
    case "banner": {
      const words = [input, ...rest].filter(Boolean).join(" ");
      if (!words) fail('banner what? ama-studio banner "ACME"');
      const R = await import("ascii-magic-art-rest");
      if (o.font && !R.fonts[o.font]) fail(`no font "${o.font}": ${Object.keys(R.fonts).join(", ")}`);
      if (o.shadow && o.shadow !== "none" && !R.shadows[o.shadow]) fail(`no shadow "${o.shadow}": ${Object.keys(R.shadows).join(", ")}, none`);
      if (o.effect && !["glint", "type", "still"].includes(o.effect)) fail(`no banner effect "${o.effect}": glint, type, still`);
      const opts = {
        ...(o.font ? { font: o.font } : {}), ...(o.shadow ? { shadow: o.shadow } : {}), ...(o.fill ? { fill: o.fill } : {}),
        ...(o.effect ? { effect: o.effect } : {}), ...(colorList(o.colors) ? { color: colorList(o.colors) } : {}),
      };
      const out = o.out;
      if (out && /\.svg$/i.test(out)) {
        let art;
        if (o.art) {
          const a = await load(o.art);
          art = a.kind === "rest" ? await R.restModule(o.art.slice(5)) : R.toRest({ meta: a.meta, default: a.create }, { seconds: 4 });
        }
        const page = (dark) => R.bannerSvg(words, { ...opts, dark, ...(o.tagline ? { tagline: o.tagline } : {}), ...(art ? { art } : {}), ...(o.place ? { place: o.place } : {}) });
        if (o.both) {
          const dark = out.replace(/(\.dark)?\.svg$/i, ".dark.svg"), light = out.replace(/(\.dark)?\.svg$/i, ".svg");
          fs.writeFileSync(light, page(false));
          fs.writeFileSync(dark, page(true));
          console.log(`README:\n<picture>\n  <source media="(prefers-color-scheme: dark)" srcset="${path.basename(dark)}">\n  <img alt="${words}" src="${path.basename(light)}">\n</picture>`);
          done(light, `"${words}" banner`);
          done(dark, `"${words}" banner, dark`);
        } else {
          fs.writeFileSync(out, page(!o.light));
          done(out, `"${words}" banner`);
        }
        break;
      }
      if (o.tagline || o.art) console.warn("note: --tagline and --art are for .svg banners; other outputs draw the letters alone");
      if (out && /\.(json|js|mjs|amc)$/i.test(out)) fail("a banner exports to .svg, .cast, .png, .gif, .mp4 or .webm, or plays without -o");
      const mod = R.fromRest(R.banner(words, opts), { slug: "banner" });
      const create = () => mod.default();
      const src = { meta: mod.meta, draw: create(), create, kind: "rest" };
      if (!out) { await play(src, playOpts); break; }
      await exportTo(src, out, exportOpts);
      done(out, `"${words}" banner`);
      break;
    }
    case "play": {
      if (!input) fail("play what? a slug (matrix-rain), a .json spec, an .amc clip or a .js piece");
      await play(await load(input, look || {}), playOpts);
      break;
    }
    case "export": {
      if (!input || !o.out) fail("ama-studio export <slug|file> -o out.(cast|png|gif|mp4|webm|svg)");
      const src = await source(input, o.out);
      const f = await exportTo(src, o.out, exportOpts);
      done(o.out, f);
      break;
    }
    default:
      fail(`no command "${cmd}". Try: convert, brand, text, banner, play, export (ama-studio --help)`);
  }
} catch (e) {
  fail(e.message);
}
