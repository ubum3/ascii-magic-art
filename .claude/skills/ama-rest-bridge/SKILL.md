---
name: ama-rest-bridge
description: ascii-magic-art-rest (packages/rest-bridge), which plays the 240 ascii.rest pieces as rest-<name> pieces (fromRest) and exports ours to ascii.rest's svg() (toRest). Use for "rest-*" pieces, "fromRest/toRest", "ascii.rest", "rest catalog", "validate-rest", "rest-golden", or rebuilding rest-bridge dist/.
---

# ama-rest-bridge

## What it is

A two-way bridge to [ascii.rest](https://github.com/bas3line/ascii) (MIT, bas3line). `fromRest` turns each of their 240 pieces into one of ours, slugged `rest-<name>`; `toRest` turns ours into theirs so their `svg()`, `banner()` and `drawing()` work on our pieces. It does not copy ascii.rest: it imports `./ascii` in the repo root, a git submodule pinned to the ubum3/ascii fork.

- Path: `packages/rest-bridge` (`src/index.js`, `src/bridge.js`, generated `src/catalog.js`, `scripts/build.mjs`, `scripts/validate-rest.mjs`)
- Package: `ascii-magic-art-rest` (`.` resolves to `dist/index.js`; `./bridge` to `src/bridge.js`)

## Quick start

```bash
git submodule update --init                          # once, in the repo root
npm install                                          # prepare runs scripts/build.mjs
```
```js
import { restPiece, toRest, svg } from "ascii-magic-art-rest";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";

const rust = await restPiece("rest-rust");            // { meta, default } like any piece
const readme = svg(toRest(torus, { seconds: 4 }), { dark: true });
```

## Core API

`src/bridge.js` (pure, no ascii.rest imports, runs in Node, browsers, QuickJS and goja):

| export | signature / meaning |
|---|---|
| `fromRest(mod, { slug, paper = false, options })` | their module to `{ meta, default }`. `meta.tags = ["ascii.rest", theirCategory]`; `cell: 1` to `cell: "square"`; `fps: 0` to `still: true`; `ground` to `meta.bg`; `clock` kept |
| `toRest(mod, { state, ink = INK, seconds, palette })` | ours to theirs; `seconds` becomes `meta.loop`; `palette` adds colours that frames bring themselves |
| `framePalettes(mod, times, state?)` | union of per-frame palettes, to pass as `toRest`'s `palette` |
| `fold(palette, most)` | `{ palette, map }`, palette folded to at most `most` colours |
| `CATEGORY` | their category to ours (logos, companies, distros to `mascots`) |
| `INK` | `"#e4e4e7"`, our default ink |

`src/index.js` (imports `../../../ascii/src/*.ts`):

| export | meaning |
|---|---|
| `restNames`, `restSlugs` | their 240 file names; the same with `rest-` |
| `isRestSlug(s)` | true only for `rest-<existing name>` |
| `restModule(slug)` | their raw module (async), by slug or name |
| `restPiece(slug, opts)` | `fromRest(await restModule(...))` (async) |
| `restPieces` | `{ "rest-rust": () => Promise<module>, ... }` |
| `REST_CATALOG` | rows `[slug, name, ourCategory, theirCategory, note, cols, rows, fps, square]` |
| `restSize(slug)` | `{ cols, rows, square }` without loading the piece |
| `svg`, `bannerSvg`, `banner`, `fonts`, `shadows`, `drawing`, `fromPixels` | re-exported from ascii.rest |

npm scripts (`packages/rest-bridge/package.json`): `build` / `prepare` = `node scripts/build.mjs`; `validate` = `node scripts/validate-rest.mjs`; `test`.

## Common tasks

**Rebuild after pulling ascii.rest**
```bash
git -C ascii pull
npm run build -w packages/rest-bridge     # regenerates src/catalog.js (if changed) and dist/
npm run native                            # repo root: rest-* in ratatui/bubbletea, rest-golden.bin
```

**Validate some or all of their pieces**
```bash
cd packages/rest-bridge
node scripts/validate-rest.mjs            # 240/240 ascii.rest pieces pass
node scripts/validate-rest.mjs rust zig   # names WITHOUT the rest- prefix
```

**Size a box before loading**
```js
import { restSize } from "ascii-magic-art-rest";
restSize("rest-alpine-dawn");   // { cols: 200, rows: 100, square: true }
```

**An animated README SVG of one of our extras specs**
```js
import { fromSpec } from "ascii-magic-art-extras";
const p = fromSpec({ kind: "progress", cols: 40 });
svg(toRest(p, { state: { value: 0.6 }, seconds: 4 }), { dark: true });
```

**Play from the CLI**: `ama-studio play rest-rust` (studio resolves `rest-*` through this package).

## Testing and verification

```bash
npm test -w packages/rest-bridge                       # 9 tests: 240 slugs, both directions, svg(), banner(), drawing()
cd packages/rest-bridge && node scripts/validate-rest.mjs   # 240/240 ascii.rest pieces pass (~7 s)
node scripts/validate.mjs                              # repo root: 634/634 pieces pass
```
Parity: `npm run native` writes `packages/fixtures/rest-golden.bin` only when `./ascii/src/pieces` exists; the ratatui and bubbletea tests compare against it. Snapshot `packages/fixtures/*.bin` before running and `cmp` afterwards.

## Rules and gotchas

- Additive only: no edits to `pieces/`, `lib/`, `runtime/`, `bin/`, or the `ascii/` and `shaders/` forks. Fix conversion problems in `src/bridge.js`, never in `ascii/`.
- Existing goldens (`golden.bin`, `rest-golden.bin`, `extras-golden.bin`) must stay byte-identical.
- Requires the `./ascii` checkout. Without it `scripts/build.mjs` exits 1 (unless `dist/index.js` already exists), `src/index.js` fails to import, and `npm run native` prints "no ascii.rest checkout at ./ascii" and leaves rest pieces out.
- `src/index.js` imports TypeScript directly: needs Node 22.18+. Older Node, browsers and bundlers must use `dist/` (the package's main export), which is git-ignored and must be built.
- `src/catalog.js` is generated by `scripts/build.mjs` ("Do not edit"). Change `fromRest`, then rebuild.
- `fromRest` keeps one colour buffer per player, because their pieces only write the cells they ink. Don't recreate it per frame.
- Palettes fold to at most 59 keys so `X`, `Y`, `Z` stay free; a test asserts this.
- `validate-rest` reports, but does not fail, characters outside the monospace-safe set.
- `rest-starlings` only gets a size check in parity tests; photo scenes (`rest-alpine-dawn`, ...) load slowly in QuickJS/goja.
- Their cells are 1:2, ours about 1:1.66, so their art looks about 17% squatter here. That is expected.
