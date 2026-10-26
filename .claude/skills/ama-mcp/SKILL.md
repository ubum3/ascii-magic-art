---
name: ama-mcp
description: ama-mcp (packages/mcp), the stdio MCP server that lets agents search pieces, render a frame as text, make banners, turn logos into brand specs and export files. Use when asked to "install/add the ama MCP server", "claude mcp add ama", "add an MCP tool", "render_frame/export/search_pieces", or to debug ama-mcp limits.
---

# ama-mcp

## What it is

`ama-mcp` is an MCP server over stdio for coding agents. It exposes five tools (`search_pieces`, `render_frame`, `make_banner`, `svg_to_brand`, `export`) over the 634 library pieces, the 240 `rest-*` ascii.rest pieces when `ascii-magic-art-rest` is installed, extras specs, `.amc` clips and `.js` pieces.

- Path: `packages/mcp` (`bin/ama-mcp.js`, `src/server.js`, `src/tools.js`, `src/catalog.js`, `src/guard.js`)
- Package: `ascii-magic-art-mcp` (bin `ama-mcp`, main `src/server.js`, Node >= 20)

## Quick start

```bash
claude mcp add ama -- node <abs path>/packages/mcp/bin/ama-mcp.js
# from the repo root, for example:
claude mcp add ama -- node "$PWD/packages/mcp/bin/ama-mcp.js"
```
In-process (as the tests do):
```js
import { createServer } from "ascii-magic-art-mcp";
await createServer({ timeout: 60_000 }).connect(transport);
```

## Core API / tools

| tool | input | returns |
|---|---|---|
| `search_pieces` | `query` (≤ 200 chars), `category`, `tag`, `limit` (1-50, default 10) | JSON `{ total, results: [{ slug, name, category, note, tags, cols, rows, fps, cell, from }] }`. Every word must match somewhere |
| `render_frame` | `source`, `t` (0-600, default 1.5), `state`, `color` (default false) | a meta line, then the frame in a code block, cut to 200x100; `color: true` adds an ANSI version |
| `make_banner` | `text` (1-64), `font` (`block`/`plain`), `effect` (TEXT_EFFECTS, default `scramble`), `colors` (≤ 3 `#rrggbb`), `t` | the extras `text` spec as JSON, plus its frame (at t = 3 by default) |
| `svg_to_brand` | `path` (.svg/.png), `cols` (20-160, default 60), `effect` (default `reveal`), `idle`, `style` (`blocks`/`glyphs`), `out`, `overwrite` | the `brand` spec as JSON (written to `out` as .json when given) and a preview frame |
| `export` | `source`, `format` (`cast gif png mp4 webm svg`), `out`, `seconds` (0.5-30, default 6), `t`, `preset`, `dark`, `state`, `overwrite` | JSON `{ path, bytes, format }`; a PNG or GIF under 1 MB also as an image |

`source` (`resolveSource` in `src/catalog.js`): a spec object; a string containing `/` or `\` or ending `.json/.amc/.js/.mjs` is a file path; `rest-...` goes to the rest bridge; anything else is a library slug.

`preset` values: `desktop-4k desktop phone youtube github-social x-header linkedin-banner square story`.

Exports from the source: `createServer({ timeout })`, `TOOLS` (array of `{ name, config, handler }`), `guarded(handler, ms)`, `cropped(frame)`, `MAX_COLS = 200`, `MAX_ROWS = 100`, `MAX_IMAGE = 1 MB`, `FORMATS`; `guard.js`: `MAX_INPUT = 20 MB`, `TIMEOUT = 60_000`, `OUT_DIR = <tmp>/ama-mcp`, `inputPath`, `outputPath`, `withTimeout`.

## Common tasks

**Add a tool**: append an object `{ name, config: { title, description, inputSchema: { ...zod }, annotations }, handler }` to `TOOLS` in `src/tools.js`. `createServer` registers every entry wrapped in `guarded`. Read files only through `inputPath`, write only through `outputPath(p, ext, { name, overwrite })`. Then update the count in `test/mcp.test.mjs` ("tools/list: the five tools") and add a test.

**Render a spec without a file**
```json
{ "name": "render_frame", "arguments": { "source": { "kind": "progress", "cols": 30 }, "state": { "value": 0.4 }, "t": 2 } }
```

**Export a README SVG into the project**
```json
{ "name": "export", "arguments": { "source": "alien-wave", "format": "svg", "out": "docs/alien.svg", "dark": true } }
```

**Logo to brand spec in glyph style**
```json
{ "name": "svg_to_brand", "arguments": { "path": "packages/extras/examples/mark.svg", "style": "glyphs", "out": "mark.json" } }
```

**Make `rest-*` sources work**: install the workspace `ascii-magic-art-rest` with a built `dist/` (needs the `./ascii` checkout, `npm run build -w packages/rest-bridge`).

## Testing and verification

```bash
npm test -w packages/mcp          # 11 tests: tools/list, each tool, limits, export, rest pieces, timeout, stdio bin
node scripts/validate.mjs         # repo root: 634/634 pieces pass
```
`test/stdio.test.mjs` spawns the real bin and checks stdout carries only protocol. Exports in tests go under `<tmp>/ama-mcp/test-*` and are removed afterwards.

## Rules and gotchas

- Additive only: no edits to `pieces/`, `lib/`, `runtime/`, `bin/`, or the `ascii/` and `shaders/` forks.
- Existing goldens (`packages/fixtures/*.bin`) must stay byte-identical.
- stdout is the protocol. `bin/ama-mcp.js` redirects `console.log/info/debug` to stderr; never write to `process.stdout` in a tool.
- Reads: inside the working directory or the OS temp folder only, symlinks resolved, at most 20 MB. The working directory is the server's cwd, so paths are relative to wherever Claude Code launched it.
- Writes: inside the working directory or `<tmp>/ama-mcp`. The extension is forced to the format's. An existing file is refused without `overwrite: true` and never written through a symlink. `export` without `out` writes a hashed name into `<tmp>/ama-mcp` and may overwrite there.
- Every call times out after 60 s. Errors come back as `isError: true` results, not protocol errors.
- `gif`, `mp4`, `webm` need `ffmpeg` on PATH (checked with studio's `hasFfmpeg`); suggest `png`, `cast` or `svg` otherwise.
- Canvas and sharp (via `ascii-magic-art-studio`) load lazily on the first `export` or `svg_to_brand`.
- Frames over 200x100 are cut; the meta line says `cut to 200×100`.
- `rest-*` without `ascii-magic-art-rest` gives an error naming that package; an unknown `rest-` name points to `search_pieces`.
