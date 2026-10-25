/*
 * tools.js: the server's tools, as data: name, config (zod input schema) and a
 * handler that returns MCP content. Pieces render as plain text, which an agent
 * reads directly; files are written by the guard's rules and returned as paths,
 * with a PNG or GIF under 1 MB also returned as an image. Studio's raster and
 * export modules load native canvas and sharp, so they are imported on first use.
 */
import fs from "fs";
import { createHash } from "crypto";
import { z } from "zod";
import { frameText } from "ascii-magic-art/runtime/player.js";
import { fromSpec, TEXT_EFFECTS, BRAND_EFFECTS, BRAND_IDLES } from "ascii-magic-art-extras";
import { catalog, resolveSource, CATEGORIES } from "./catalog.js";
import { inputPath, outputPath, withTimeout } from "./guard.js";

export const MAX_COLS = 200, MAX_ROWS = 100, MAX_IMAGE = 1024 * 1024;
export const FORMATS = ["cast", "gif", "png", "mp4", "webm", "svg"];

const text = (s) => ({ type: "text", text: s });
const json = (v) => text(JSON.stringify(v, null, 2));
const HEX = z.string().regex(/^#[0-9a-fA-F]{6}$/, "a colour as #rrggbb");
const source = z.union([z.string().min(1), z.record(z.string(), z.unknown())])
  .describe('A library slug ("alien-wave"), an ascii.rest name ("rest-…"), a path to a .json spec, .amc clip or .js piece, or an extras spec object ({ kind: "text", text: "HI" }).');

/** A frame's text, cut to MAX_COLS x MAX_ROWS, and whether it was cut. */
export function cropped(frame) {
  const rows = frameText(frame).split("\n");
  const cut = rows.length > MAX_ROWS || rows.some((r) => [...r].length > MAX_COLS);
  return { text: rows.slice(0, MAX_ROWS).map((r) => [...r].slice(0, MAX_COLS).join("")).join("\n"), cut };
}
const block = (s) => "```\n" + s + "\n```";
const about = (meta, name) => `${name} · ${meta.cols}×${meta.rows}${meta.cell === "square" ? " square cells" : ""} · ${meta.fps || 24} fps${meta.category ? " · " + meta.category : ""}`;

function score(e, words) {
  let s = 0;
  for (const w of words) {
    let hit = 0;
    if (e.slug === w) hit += 12; else if (e.slug.includes(w)) hit += 6;
    if (e.name.toLowerCase().includes(w)) hit += 4;
    if (e.tags.some((t) => t.toLowerCase() === w)) hit += 5; else if (e.tags.some((t) => t.toLowerCase().includes(w))) hit += 2;
    if (e.category.includes(w)) hit += 3;
    if (e.note.toLowerCase().includes(w)) hit += 1;
    if (!hit) return 0; // every word has to match somewhere
    s += hit;
  }
  return s;
}

export const TOOLS = [
  {
    name: "search_pieces",
    config: {
      title: "Search ASCII pieces",
      description: `Search the animated ASCII pieces by words in their slug, name, tags, category and note (every word must match). Returns JSON: [{ slug, name, category, note, tags, cols, rows, fps, cell, from }]. Categories: ${CATEGORIES.join(", ")}.`,
      inputSchema: {
        query: z.string().max(200).optional().describe("Words to look for, e.g. \"space shooter\". Empty lists everything that passes the filters."),
        category: z.string().max(40).optional().describe("Only this category id."),
        tag: z.string().max(40).optional().describe("Only pieces with this tag."),
        limit: z.number().int().min(1).max(50).default(10),
      },
      annotations: { readOnlyHint: true },
    },
    async handler({ query = "", category, tag, limit = 10 }) {
      const words = query.toLowerCase().split(/\s+/).filter(Boolean);
      let all = (await catalog()).filter((e) => (!category || e.category === category) && (!tag || e.tags.includes(tag)));
      if (words.length) all = all.map((e) => [score(e, words), e]).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0] || a[1].slug.localeCompare(b[1].slug)).map(([, e]) => e);
      return { content: [json({ total: all.length, results: all.slice(0, limit) })] };
    },
  },
  {
    name: "render_frame",
    config: {
      title: "Render a frame as text",
      description: `Draw one frame of a piece, spec or clip at time t, as plain text in a code block (cut to ${MAX_COLS}×${MAX_ROWS}). The same source and t always give the same text. color: true adds the same frame with ANSI colour codes.`,
      inputSchema: {
        source,
        t: z.number().min(0).max(600).default(1.5).describe("Seconds into the piece."),
        state: z.record(z.string(), z.unknown()).optional().describe("State for a data kind, e.g. { value: 0.4 } for progress or { values: [...] } for sparkline."),
        color: z.boolean().default(false),
      },
      annotations: { readOnlyHint: true },
    },
    async handler({ source: src, t = 1.5, state, color = false }) {
      const p = await resolveSource(src);
      const frame = p.draw(t, state);
      const { text: s, cut } = cropped(frame);
      const content = [text(about(p.meta, p.name) + (cut ? ` · cut to ${MAX_COLS}×${MAX_ROWS}` : "")), text(block(s))];
      if (color) {
        const { ansi } = await import("ascii-magic-art-studio/src/ansi.js");
        content.push(text(ansi({ color: true, truecolor: true }).lines(frame, p.meta, MAX_COLS, MAX_ROWS).join("\n")));
      }
      return { content };
    },
  },
  {
    name: "make_banner",
    config: {
      title: "Make a text banner",
      description: `Words in a 5-row block font (or plain), with an entrance effect. Returns the extras "text" spec as JSON, which render_frame, export and every ascii-magic-art host play, and its resting frame as text. Effects: ${TEXT_EFFECTS.join(", ")}.`,
      inputSchema: {
        text: z.string().min(1).max(64),
        font: z.enum(["block", "plain"]).default("block"),
        effect: z.enum(TEXT_EFFECTS).default("scramble"),
        colors: z.array(HEX).max(3).optional().describe("Main, accent and shadow colours."),
        t: z.number().min(0).max(60).optional().describe("Seconds in for the preview: once the entrance is done by default."),
      },
      annotations: { readOnlyHint: true },
    },
    async handler({ text: words, font = "block", effect = "scramble", colors, t }) {
      const spec = { kind: "text", text: words, font, effect, ...(colors ? { colors } : {}) };
      const p = fromSpec(spec);
      const { text: s } = cropped(p.default()(t ?? 3, undefined));
      return { content: [json(spec), text(block(s))] };
    },
  },
  {
    name: "svg_to_brand",
    config: {
      title: "Logo to brand spec",
      description: `Turn an SVG or PNG logo into an extras "brand" spec: the logo as a mask in its own colours, with an entrance (${BRAND_EFFECTS.join(", ")}) and an idle loop (${BRAND_IDLES.join(", ")}). Returns the spec as JSON (also written to out when given) and a preview frame as text.`,
      inputSchema: {
        path: z.string().min(1).describe("An .svg or .png file inside the working directory or the temp folder, at most 20 MB."),
        cols: z.number().int().min(20).max(160).default(60),
        effect: z.enum(BRAND_EFFECTS).default("reveal"),
        idle: z.enum(BRAND_IDLES).optional(),
        style: z.enum(["blocks", "glyphs"]).default("blocks").describe("blocks: shaded cells; glyphs: characters shaped like the outline, as ascii.rest draws its logos."),
        out: z.string().optional().describe("Also write the spec here, as .json."),
        overwrite: z.boolean().default(false),
      },
    },
    async handler({ path: file, cols = 60, effect = "reveal", idle, style = "blocks", out, overwrite = false }) {
      const input = inputPath(file);
      if (!/\.(svg|png)$/i.test(input)) throw new Error("svg_to_brand takes an .svg or .png file");
      const { brandSpec } = await import("ascii-magic-art-studio/src/raster.js");
      const spec = await brandSpec(input, { cols, effect, idle, ...(style !== "blocks" ? { style } : {}) });
      const content = [json(spec)];
      if (out) {
        const target = outputPath(out, "json", { overwrite });
        fs.writeFileSync(target, JSON.stringify(spec));
        content.push(text(`wrote ${target}`));
      }
      content.push(text(block(cropped(fromSpec(spec).default()(4)).text)));
      return { content };
    },
  },
  {
    name: "export",
    config: {
      title: "Export to a file",
      description: `Render a piece, spec or clip to a file: an asciinema .cast, a GIF, a PNG (one frame), MP4 or WebM (these three need ffmpeg), or an animated SVG for a README. Returns { path, bytes, format } as JSON, and a PNG or GIF under 1 MB also as an image. Without out it writes to the ama-mcp temp folder.`,
      inputSchema: {
        source,
        format: z.enum(FORMATS),
        out: z.string().optional().describe("Where to write it, inside the working directory or the ama-mcp temp folder. The extension follows the format."),
        seconds: z.number().min(0.5).max(30).default(6),
        t: z.number().min(0).max(600).optional().describe("For png: the moment to show."),
        preset: z.enum(["desktop-4k", "desktop", "phone", "youtube", "github-social", "x-header", "linkedin-banner", "square", "story"]).optional().describe("An image size for png, gif and video."),
        dark: z.boolean().optional().describe("svg: dark-page colours. png, gif, video: false draws on white."),
        state: z.record(z.string(), z.unknown()).optional(),
        overwrite: z.boolean().default(false),
      },
    },
    async handler({ source: src, format, out, seconds = 6, t, preset, dark, state, overwrite = false }) {
      const p = await resolveSource(src);
      if (["gif", "mp4", "webm"].includes(format)) {
        const { hasFfmpeg } = await import("ascii-magic-art-studio/src/video.js");
        if (!hasFfmpeg()) throw new Error(`${format} export needs ffmpeg on the PATH: try png, cast or svg`);
      }
      const name = `${p.name}-${createHash("sha1").update(JSON.stringify([src, format, seconds, t, preset, dark, state])).digest("hex").slice(0, 8)}`;
      // our own temp folder is ours to overwrite; anywhere else needs the caller to say so
      const file = outputPath(out, format, { name, overwrite: overwrite || !out });
      const { exportTo } = await import("ascii-magic-art-studio/src/export.js");
      const opts = { format, seconds, state, ...(t != null ? { at: t } : {}), ...(preset ? { preset } : {}), ...(dark != null ? { dark, light: format === "svg" && dark === false } : {}), ...(dark === false && format !== "svg" ? { bg: "#ffffff" } : {}) };
      try {
        await exportTo(p, file, opts);
      } catch (e) {
        if (format === "svg" && /can't export/.test(e.message)) throw new Error("svg export needs a newer ascii-magic-art-studio (one with the svg format)");
        throw e;
      }
      const bytes = fs.statSync(file).size;
      const content = [json({ path: file, bytes, format })];
      if ((format === "png" || format === "gif") && bytes < MAX_IMAGE) content.push({ type: "image", data: fs.readFileSync(file).toString("base64"), mimeType: `image/${format}` });
      return { content };
    },
  },
];

/** The handler with the limits on: a 60 s timeout, and errors as an isError result rather than a protocol error. */
export const guarded = (handler, ms) => async (args) => {
  try {
    return await withTimeout(handler(args), ms);
  } catch (e) {
    return { isError: true, content: [text(e.message || String(e))] };
  }
};
