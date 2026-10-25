# ascii-magic-art-mcp

`ama-mcp` is an MCP server over stdio. It lets a coding agent find a piece, read a frame as text, make a banner or a brand spec, and export a file.

```sh
claude mcp add ama -- node /abs/path/to/packages/mcp/bin/ama-mcp.js      # from a checkout
claude mcp add -s project ama -- npx -y ascii-magic-art-mcp             # once published; -s project writes .mcp.json
```

| tool | input | returns |
|---|---|---|
| `search_pieces` | `query`, `category`, `tag`, `limit` (≤ 50) | JSON `{ total, results: [{ slug, name, category, note, tags, cols, rows, fps, cell, from }] }`. Every word has to match. |
| `render_frame` | `source`, `t`, `state`, `color` | a meta line, then the frame as text in a code block, cut to 200×100. With `color`, the ANSI version as well. |
| `make_banner` | `text` (≤ 64), `font`, `effect`, `colors` (≤ 3) | the extras `text` spec as JSON, and its frame |
| `svg_to_brand` | `path` (.svg/.png), `cols` (20–160), `effect`, `idle`, `style`, `out` | the `brand` spec as JSON (also written to `out`), and a preview frame |
| `export` | `source`, `format` (cast, gif, png, mp4, webm, svg), `out`, `seconds` (≤ 30), `t`, `preset`, `dark`, `state` | JSON `{ path, bytes, format }`, plus the image itself for a PNG or GIF under 1 MB |

A `source` is a library slug, an ascii.rest name (`rest-…`, when `ascii-magic-art-rest` is installed), a path to a `.json` spec, an `.amc` clip or a `.js` piece, or a spec object.

**Limits:**
- Files it reads must be inside the working directory or the temp folder, and at most 20 MB.
- Files it writes go inside the working directory or `<tmp>/ama-mcp` (the default), with the extension the format gives. An existing file is only replaced with `overwrite: true`, and never through a symlink.
- Each call gets 60 seconds.
- GIF, MP4 and WebM need ffmpeg.
- Errors come back as `isError` results.
- stdout carries only the protocol; logs go to stderr.
- Canvas and sharp load on the first `export` or `svg_to_brand`, so the server starts fast.
