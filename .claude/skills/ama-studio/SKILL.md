---
name: ama-studio
description: ama-studio CLI (packages/studio, ascii-magic-art-studio): turn pictures, videos, logos and words into ASCII art specs/clips and export pieces to cast, PNG, GIF, MP4, WebM or SVG. Use to "convert a video to an .amc clip", "make a logo spec", "export a piece to GIF/SVG for a README", "ama-studio brand/text/banner/bake", or play a slug in the terminal.
---

# ama-studio: make and export ASCII art

## What it is

A Node CLI, `ama-studio`, that makes animated ASCII art from your own pictures, videos, SVG/PNG logos, words and WebGPU shaders, and exports any piece, spec or clip to an asciinema cast, PNG, GIF, MP4, WebM or animated SVG. Its `.json` specs and `.amc` clips play in every host package (React, ratatui, bubbletea).
Lives in `packages/studio`. npm package `ascii-magic-art-studio`, bin `ama-studio` (`bin/ama-studio.js`), Node 20+. Depends on `ascii-magic-art-extras`, `ascii-magic-art-rest`, `sharp`, `@napi-rs/canvas`, `esbuild`.

## Quick start

```bash
npx ama-studio --help
npx ama-studio play matrix-rain                         # any key stops it
npx ama-studio brand logo.svg --effect assemble -o logo.json
npx ama-studio export moonlit-sea -o moonlit.mp4 --seconds 8 --look dots
```

The output format comes from the extension of `-o`. Without `-o` the result plays in the terminal.

## Core API / commands

| command | input | notes |
|---|---|---|
| `convert <image\|gif\|video>` | PNG, JPEG, WebP, AVIF, TIFF, SVG; or gif/mp4/mov/webm/mkv/avi/m4v/mpg | pictures -> `image` spec; videos -> `.amc` clip (`--fps` 12, `--seconds` 10, `--start`) |
| `brand <logo.svg\|png>` | a logo | `--effect` (default `reveal`), `--idle`, `--style blocks\|glyphs`, `--colors "#a,#b"`, `--cols` (60), `--accent` |
| `text "<words>"` | words | block font, `--effect` (default `scramble`), `--font block\|plain`, `--no-shadow` |
| `banner "<words>"` | words | ascii.rest fonts: `--font`, `--shadow`, `--fill`, `--effect glint\|type\|still`; `.svg` adds `--tagline`, `--art <slug>`, `--place` |
| `play <slug\|file>` | slug, `rest-<name>`, `.json`, `.amc`, `.js`/`.mjs` | `--frame` prints one frame and exits; `--state JSON` |
| `export <slug\|file> -o out` | same as play | `-o` is required |
| `bake <scene.jsx\|Names>` | `"Aurora,FilmGrain"` or a module | headless Chromium (`$CHROME` or `chromium`), `--seconds` 6, `--fps` 12, `--cols` 80, `--colors` 48 |

Outputs: `.json` spec, `.js` self-contained piece module (`{ meta, default }`), `.amc` clip, and `FORMATS = ["cast", "png", "gif", "mp4", "webm", "svg"]` (`src/export.js`).

Options (from `parseArgs` in `bin/ama-studio.js`): `-o/--out`, `--cols`, `--rows`, `--square`/`--text`, `--colors`, `--look`, `--chars`, `--mono`, `--motion glint,breathe=0.3,water=0.6,twinkle=0.5,drift=0.3,birds=5,shooting`, `--effect`, `--idle`, `--duration`, `--loop`, `--font`, `--fps`, `--seconds`, `--start`, `--state`, `--px` (16), `--width`, `--height`, `--preset desktop|desktop-4k|phone|youtube|github-social|x-header|linkedin-banner|square|story`, `--bg`, `--at` (PNG frame time), `--frame`, `--name`, `--style`, `--dark`/`--light`/`--both`, `--format`, `-h/--help`.

Effects: brand `reveal draw assemble matrix glitch halftone spin3d shimmer`; idle `shimmer still pulse rain`; text `typewriter wave rainbow scramble glitch plain`.

Library (`src/`): `load(src, look)` (`load.js`), `imageSpec(file, opts)`, `brandSpec(file, opts)` (`raster.js`), `videoClip`, `decodeVideo`, `framesClip`, `hasFfmpeg` (`video.js`), `bakeClip`, `bakeFrames`, `findChromium` (`bake.js`), `exportTo(src, file, opts)`, `toCast`, `toPng`, `toVideo` (`export.js`), `toSvg`, `svgText`, `periodOf` (`svg.js`), `play` (`play.js`), `pieceModule(spec)` (`piecejs.js`).

## Common tasks

```bash
# 1. An ascii.rest piece: play, export
npx ama-studio play rest-rust
npx ama-studio export rest-ubuntu -o ubuntu.gif --seconds 4
```

```bash
# 2. Specs for packages/extras hosts (<AsciiSpec>, Player::from_spec, asciiart.FromSpec)
npx ama-studio brand logo.svg --effect assemble --idle shimmer --style glyphs -o logo.json
npx ama-studio text "DEPLOYED" --effect scramble -o deployed.json
npx ama-studio convert photo.jpg --motion glint,breathe=0.3 -o photo.json
```

```bash
# 3. Data spec with state (progress, sparkline, ticker, celebrate)
npx ama-studio play bar.json --state '{"value":0.5,"label":"Uploading"}'
```

```bash
# 4. Video or GIF to a clip (or straight to a GIF)
npx ama-studio convert demo.mp4 -o demo.amc --cols 80 --fps 12 --seconds 6
npx ama-studio convert demo.mp4 -o demo.gif
```

```bash
# 5. Looks and theming in exports
npx ama-studio export moonlit-sea -o moonlit.png --look dots --bg "#0b0b14" --at 2.5 --preset github-social
npx ama-studio export matrix-rain -o rain.cast --chars " .oO@" --seconds 5
```

```bash
# 6. Animated SVGs for a README (dark default, --light, or --both + <picture>)
npx ama-studio export logo.json -o logo.svg --both
npx ama-studio banner "ACME" --font slim --tagline "payments" -o banner.svg
```

```bash
# 7. A WebGPU shader as a clip (AsciiShader fallback in React)
npx ama-studio bake "Aurora,FilmGrain" -o aurora.amc
```

## Testing and verification

```bash
npm test -w packages/studio            # node --test test/*.test.mjs (from the repo root)
node scripts/validate.mjs              # must print 634/634 pieces pass
node packages/studio/bin/ama-studio.js text HI --effect plain --frame   # quick smoke
```

`test/studio.test.mjs` covers brand (SVG and PNG), convert, cast, PNG export via `runtime/canvas.js`, video (skipped without ffmpeg), piece modules, the CLI, SVG periods and `--both`, rest pieces, banner, `--style glyphs`, and bake (skipped without Chromium). Skipped tests are not passes: install `ffmpeg`/Chromium to cover those paths. If you changed `packages/extras`, also run `npm test -w packages/extras` and the Rust/Go parity tests.

## Rules and gotchas

- Additive only: never edit `pieces/`, `lib/`, `runtime/` or `bin/` (the root CLI). Studio code goes in `packages/studio`.
- After changing the JS engine or `packages/extras`, run `npm run native` in the repo root to regenerate `pieces.bin` and the goldens in `packages/fixtures/`. Existing goldens must stay byte-identical.
- `ffmpeg` on PATH is required for video/GIF input and every export except `.cast`, `.png` and `.svg`. `bake` needs Chromium plus `react`, `react-dom` and `shaders` resolvable from the scene's folder or cwd.
- `.amc` only comes from video, GIF or `bake`; a picture to `.amc` fails ("use .json"). A clip cannot be written as `.json`/`.js`. A banner cannot be `.json`/`.js`/`.amc`.
- `--tagline`, `--art` and `--place` only apply to `.svg` banners.
- `--fps` is capped at 30 (25 for GIF). An SVG plays one loop: without `--seconds` it searches periods 2/3/4/6/8/12 s, else loops 4 s and warns. SVGs aim for under 1 MB.
- Pictures default to square-pixel cells (half blocks in a terminal); passing `--look` or `--chars` switches to text cells unless `--square`.
- A `.cast` gets the look applied to its text frames; images/videos get looks from `runtime/canvas.js`. Clips warn above 5 MB: lower `--cols`, `--fps` or `--seconds`.
- A bad slug exits 1 with "Did you mean: ..."; `rest-<name>` (or `rest:<name>`) resolves via `ascii-magic-art-rest`.
- `--effect`, `--idle`, `--look`, `--font`, `--shadow` are validated against the real lists; invalid values exit 1.
