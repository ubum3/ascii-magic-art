# ascii-magic-art-rest

[ascii.rest](https://github.com/bas3line/ascii), by bas3line (MIT), for ascii-magic-art. It works both ways:

- **Their 240 pieces as ours.** Every logo, company, Linux distro and scene is called `rest-<name>`, for example `rest-rust`, `rest-ubuntu` or `rest-night-coast`. They play everywhere ours do: `ama-studio`, React (`ascii-magic-art-react/rest`), ratatui and Bubble Tea.
- **Their tools for ours.** You get their animated SVGs (`svg()`, for READMEs), their banner fonts (`banner()`, `bannerSvg()`), and their logo drawing (`drawing()`), which picks the characters whose shapes match a logo's edges.

```js
import { restPiece, toRest, svg } from "ascii-magic-art-rest";
import * as torus from "ascii-magic-art/pieces/spinning-torus.js";

const rust = await restPiece("rest-rust");           // { meta, default } like any piece of ours
const readme = svg(toRest(torus, { seconds: 4 }), { dark: true });
```

From the command line, `ama-studio` does all of this:

```bash
ama-studio play rest-rust
ama-studio export logo.json -o logo.svg --both    # logo.svg, logo.dark.svg and the <picture> for a README
ama-studio banner "ACME" --font slim --tagline "payments, everywhere" --art rest-rust -o banner.svg
ama-studio brand logo.svg --style glyphs -o logo.json
```

## The ascii.rest checkout

This package keeps no copy of ascii.rest inside it. It reads `./ascii` in the repo root, a copy of the [ubum3/ascii](https://github.com/ubum3/ascii) fork committed with this repo:

```bash
npm install          # builds dist/ (scripts/build.mjs)
```

- **`src/index.js`** imports their TypeScript directly. Node 22.18+ runs it as is, because their code uses only erasable syntax.
- **`dist/`** is the same code bundled with esbuild, for browsers, bundlers and older Node. Each piece is its own chunk. `npm install` builds it, and so does `npm run build`.
- **`src/catalog.js`** lists each piece's name, size and tags, so a page can size a piece's box before the piece loads. The build regenerates it.

After pulling ascii.rest, run `npm run build` here and `npm run native` in the repo root (for ratatui and Bubble Tea).

## How the conversion works

`fromRest(module)` turns their piece into ours:

- **Frames.** Their frame is one string, with each cell's colour written as a palette index into `env.color`. Ours is `{ text, color }`, with a palette key per cell. Blank cells get `" "`.
- **Colour buffer.** One buffer lives for the whole life of a player, as their `svg()` does it, because their pieces only write the cells they ink.
- **Palette.** Their palettes go up to 64 colours, and are often light colours followed by dark ones. Each piece is drawn for a dark page, and its palette is folded to at most 59 keys, so the effect keys `X`, `Y` and `Z` stay free.
- **Meta.**
  - `cell: 1` becomes `cell: "square"`.
  - `fps: 0` becomes `still: true`.
  - `ground` becomes `meta.bg`, which `ama-studio` draws behind the piece.
  - `clock` is kept.
- **Categories.** Ours have no logos category, so logos, companies and distros go under `mascots`. The original category is the second tag.
- **Cell shape.** Their cells are 1:2 and ours are about 1:1.66, so their art looks about 17% squatter here.

`toRest(module, { state, seconds })` turns ours into theirs, for `svg()`:

- **Palette.** It's built in key order, with one more entry for our default ink.
- **Colours.** Every cell's index is written on every frame.
- **Loop.** `seconds` sets the SVG's loop.

## Checks

```bash
npm test               # the bridge both ways, svg(), banner(), drawing()
npm run validate       # all 240 pieces held to scripts/validate.mjs's checks
```

`validate` currently passes for all 240 pieces. Every frame is the right size, every key is in the palette, the pieces animate (or are stills), each frame draws in under 12 ms in Node, and every character is one cell wide.

In ratatui and Bubble Tea, `rest-*` pieces are checked against Node by the same parity tests as ours (`packages/fixtures/rest-golden.bin`). `rest-starlings` is a flocking simulation, so like `clifford-attractor` it only gets a size check. Some photo scenes (`rest-alpine-dawn`, `rest-ocean-sunset` and others) take seconds to load in QuickJS or goja, so load them before you need them.

## Licence

MIT. ascii.rest is MIT licensed, © bas3line. Its logos are trademarks of their owners, shown to name the product. See `NOTICE` in the repo root.
