---
name: ama-extras
description: ascii-magic-art-extras (packages/extras), pieces made from JSON specs (image, brand, text, progress, sparkline, ticker, celebrate, qr, layout). Use when asked to "add a spec kind", "make a banner/progress/sparkline spec", "fromSpec", "extras fixture", "extras-golden", or to change anything under packages/extras.
---

# ama-extras

## What it is

`ascii-magic-art-extras` turns a plain JSON spec (`{ kind, ... }`) into a piece module that plays anywhere a piece does: web, React, the CLI, and the Rust (QuickJS) and Go (goja) terminal packages, which run this exact code. Every kind is deterministic and draws a frame in well under 1 ms.

- Path: `packages/extras` (entry `src/index.js`, types `src/index.d.ts`)
- Package: `ascii-magic-art-extras` (subpath exports `./media`, `./clip`)

## Quick start

```js
import { fromSpec } from "ascii-magic-art-extras";

const draw = fromSpec({ kind: "text", text: "DEPLOYED", effect: "scramble" }).default();
draw(1.2);                                             // { text, color }
const bar = fromSpec({ kind: "progress", cols: 40 }).default();
bar(0.5, { value: 0.42, label: "Uploading" });         // data kinds take state
```

## Core API

| export | signature / meaning |
|---|---|
| `KINDS` | map of kind name to `(spec) => { meta, create }`. Built in `src/index.js` as `{ image, brand, text, progress, sparkline, ticker, celebrate }`, then `KINDS.qr = qr;` and `KINDS.layout = layoutKind;` |
| `make(spec)` | spec (object or JSON string) to `{ meta, create }`. Throws `unknown kind "x": one of image, brand, ...` |
| `fromSpec(spec, look?)` | `{ meta, default: create }`, a frozen piece module. `look` (`{ look, chars, mono }`) restyles every frame via `runtime/glyphs.js` `restyle` |
| `BRAND_EFFECTS` | `reveal draw assemble matrix glitch halftone spin3d shimmer` |
| `BRAND_IDLES` | `shimmer still pulse rain` |
| `TEXT_EFFECTS` | `typewriter wave rainbow scramble glitch plain` |
| `QR_EFFECTS` | from `ascii-magic-art-qr/kind` (`src/qr.js` only re-exports it) |
| `layout(text, font?)` | block-font layout `{ px, w, h, count }` |
| `cellsFromPixels(rgba, w, h, { palette, colors, gamma })` | pixels to `{ cols, rows, palette, color, level }` (image spec cells) |
| `buildPalette(buffers, n = 48)` | median-cut palette, at most 59 colours |
| `cellsFrame(cells)`, `gridSize(pw, ph, cols, square = true)` | cells to a frame; grid size for a picture |
| `encodeClip(header, frames, deflateRaw)`, `decodeClip(bytes, inflateRaw)`, `readClipHeader`, `splitFrames`, `clipPiece(clip)` | the `.amc` clip format |
| `TRANSITIONS`, `mixFrames(kind, a, b, p, w, h)`, `mergePalettes(palettes)`, `sequence(pieces, { hold, kind, duration, loop })` | cell-level transitions and playlists |

Kinds and their per-frame state (`draw(t, state)`):

| kind | file | state |
|---|---|---|
| `image` | `src/image.js` | none |
| `brand` | `src/brand.js` | none |
| `text` | `src/text.js` | none |
| `progress`, `sparkline`, `ticker`, `celebrate` | `src/data.js` | `{ value, label }`, `{ values, label }`, `{ items }`, `{ message, style }` |
| `qr` | `src/qr.js` (lives in `packages/qr`) | none |
| `layout` | `src/layout.js` (`layoutKind`) | `{ regions: { id: state }, play: { id: n } }` |

A kind function returns `{ meta, create }`; `create()` returns `draw(t, state?)`. Build `meta` with `metaFor(spec, { cols, rows, fps, palette })` from `src/util.js`; `layers(cols, rows)` and `join(rows)` give blank `{ T, C }` grids and turn them into strings. `FX` reserves palette keys `X`, `Y`, `Z` for accent, dim and extra.

## Common tasks

**Add a new spec kind** (example name `gauge`):
1. Create `packages/extras/src/gauge.js` exporting `export function gauge(spec) { ... return { meta, create }; }`. Use `metaFor`, `layers`, `join` from `./util.js`. No `Math.random`, no clock: everything must be a function of `(t, state)` (and draw-call order, at most, for easing).
2. In `src/index.js` add `import { gauge } from "./gauge.js";` and a new line `KINDS.gauge = gauge;` after `KINDS.layout = layoutKind;`. Do not edit the `KINDS = { ... }` object literal (that would reorder the kind list in error messages). Add `gauge` to the named re-exports.
3. In `src/index.d.ts` add a `GaugeSpec extends Common { kind: "gauge"; ... }` interface, add it to the `Spec` union (and any state type to `State`), and declare `export declare function gauge(spec: GaugeSpec): { meta: PieceMeta; create: () => StateDrawFn };`.
4. In `test/fixtures.js`, append the fixture(s) at the END of `fixtures()`, just before `return out;`, e.g. `out.push(["gauge", { kind: "gauge", cols: 30 }, { value: 0.6 }]);`. Never insert in the middle or rename existing entries.
5. `npm test -w packages/extras`. Each fixture must keep exact size, animate (more than 3 distinct frames over 6 s, unless listed in `STILL` in `test/extras.test.mjs`), be deterministic, and stay under 12 ms a frame.
6. Snapshot the goldens, then run `npm run native` in the repo root (rebuilds the QuickJS/goja bundle and `packages/fixtures/extras-golden.bin`).
7. Check that old goldens are unchanged (script in "Testing and verification").

**Render a frame from a spec in Node**
```bash
node -e 'import("ascii-magic-art-extras").then(m=>console.log(m.fromSpec({kind:"text",text:"HI",effect:"plain"}).default()(2).text))'
```

**A picture spec from pixels**
```js
import { cellsFromPixels } from "ascii-magic-art-extras";
const spec = { kind: "image", ...cellsFromPixels(rgba, w, h, { colors: 24 }), motion: { glint: true } };
```

**A dashboard: several specs on one screen**
```js
fromSpec({ kind: "layout", cols: 48, rows: 14, regions: [
  { id: "tps", x: 0, y: 2, w: 28, h: 6, spec: { kind: "sparkline", label: "TPS" } },
  { id: "burst", x: 0, y: 1, w: 48, h: 12, play: 3, spec: { kind: "celebrate", style: "fireworks" } },
] }).default()(t, { regions: { tps: { values } }, play: { burst: 1 } });  // bump play.burst to replay
```

**Play pieces one after another**
```js
import { sequence } from "ascii-magic-art-extras";
const show = sequence([a, b], { kind: "melt", hold: 3, duration: 0.8 });
```

## Testing and verification

```bash
npm test -w packages/extras              # 46 tests: every fixture, clips, transitions, layout
node scripts/validate.mjs                # repo root: must print 634/634 pieces pass
npm run native                           # after ANY change in packages/extras
cd packages/ratatui && cargo test --test extras        # Rust parity (every_fixture_matches_node)
cd packages/bubbletea && go test -run TestExtrasParityWithNode .   # Go parity
```

Golden check around `npm run native` (from the repo root):
```bash
mkdir -p /tmp/ama-golden && cp packages/fixtures/*.bin /tmp/ama-golden/
npm run native
cmp packages/fixtures/golden.bin /tmp/ama-golden/golden.bin
cmp packages/fixtures/rest-golden.bin /tmp/ama-golden/rest-golden.bin
node -e 'const fs=require("fs"),z=require("zlib"),rd=f=>JSON.parse(z.inflateRawSync(fs.readFileSync(f)));
const a=rd(process.argv[1]),b=rd(process.argv[2]);
const bad=Object.keys(a).filter(k=>JSON.stringify(a[k])!==JSON.stringify(b[k]));
console.log(bad.length?"CHANGED: "+bad:"old fixtures identical","| added:",Object.keys(b).filter(k=>!(k in a)).join(", "));
process.exit(bad.length?1:0)' /tmp/ama-golden/extras-golden.bin packages/fixtures/extras-golden.bin
```
`extras-golden.bin` itself grows when you add a fixture; every pre-existing entry must be identical.

## Rules and gotchas

- Additive only: no edits to `pieces/`, `lib/`, `runtime/`, `bin/`, or the `ascii/` and `shaders/` forks.
- Existing goldens (`packages/fixtures/golden.bin`, `rest-golden.bin`, and every old entry of `extras-golden.bin`) must stay byte-identical.
- New kinds go in as a separate `KINDS.x = x;` line; new fixtures go at the end of `fixtures()`.
- Code runs in QuickJS and goja after esbuild lowers it to ES2017: no `Intl`, no Node or DOM APIs, no `Math.random`, no `Date.now()`/`performance.now()`.
- Frames must be exactly `cols x rows`, and every colour key must be in `meta.palette`. Keep `X`, `Y`, `Z` for `FX` effects.
- `fromSpec` with a `look` that is `"original"` (and no `chars`/`mono`) returns the plain draw function.
- `qr` is implemented in `packages/qr` (`ascii-magic-art-qr/kind`); change it there, not in `src/qr.js`.
- Forgetting `npm run native` leaves the Rust and Go packages on the old bundle and their parity tests failing.
