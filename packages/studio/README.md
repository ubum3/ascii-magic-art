# ama-studio

Make animated ASCII art from your own pictures, videos, logos and words, and export any piece to an asciinema cast, a GIF, a video or a PNG.

```bash
npx ama-studio convert photo.jpg                         # play it in the terminal
npx ama-studio convert photo.jpg --motion glint,breathe=0.3 -o photo.json
npx ama-studio convert demo.mp4 -o demo.amc              # a video or GIF becomes a clip
npx ama-studio convert demo.mp4 -o demo.gif              # ...or straight to a GIF
npx ama-studio brand logo.svg --effect assemble -o logo.json
npx ama-studio text "DEPLOYED" --effect scramble -o deployed.cast
npx ama-studio play matrix-rain                          # a slug, a .json spec, an .amc clip or a .js piece
npx ama-studio export moonlit-sea -o moonlit.mp4 --seconds 8 --look dots
```

The output format comes from the extension you give `-o`. Without `-o`, the result plays in the terminal, and any key stops it.

| extension | what you get |
|---|---|
| `.json` | a **spec**. It plays in React (`<AsciiSpec>`), Rust (`Player::from_spec`), Go (`asciiart.FromSpec`) and `ama-studio play` |
| `.js` | one self-contained piece module (`{ meta, default }`) with no imports |
| `.amc` | a **clip**: video frames, read natively by every package |
| `.cast` | an asciinema cast (asciicast v2): text, tiny, crisp at any size |
| `.png` `.gif` `.mp4` `.webm` | drawn by `runtime/canvas.js`, exactly like the web player, then encoded by ffmpeg |

## Commands

- **`convert <image|gif|video>`**
  - **Pictures:** PNG, JPEG, WebP, AVIF, TIFF and SVG become an `image` spec. It's drawn in 48 colours × 8 brightness levels, in square pixels by default, which show as half blocks in a terminal. It can move with `--motion`: `glint`, `breathe=0.3`, `water=0.6`, `twinkle=0.5`, `drift=0.3`, `birds=5` and `shooting`.
  - **Video and GIF:** these become an `.amc` clip. Use `--fps` (default 12), `--seconds` (default 10) and `--start` to choose what's sampled. All frames share one palette.
- **`brand <logo.svg|png>`:** a logo mask with an entrance and an idle loop.
  - The logo is trimmed, fitted to `--cols` (default 60) with a cell of padding, and sampled at 4×7 points per cell, which gives soft edges.
  - It keeps its own colours. `--colors "#hex,#hex"` replaces them, in order of how much of the logo each one covers.
  - A PNG without transparency has its corner colour treated as the background.
- **`text "<words>"`:** words in a 5-row block font with a drop shadow, or use `--font plain`.
- **`play`** and **`export`:** for anything that plays. `--state '{"value":0.5}'` feeds a data spec.

Effects, also listed by `--help`:

- **Brand (`--effect`):** `reveal`, `draw`, `assemble`, `matrix`, `glitch`, `halftone`, `spin3d`, `shimmer`
- **Brand idle (`--idle`):** `shimmer`, `still`, `pulse`, `rain`
- **Text:** `typewriter`, `wave`, `rainbow`, `scramble`, `glitch`, `plain`

## Export options

- **Length and size:** `--seconds` and `--fps` (capped at 30, and 25 for GIF). `--px` sets the font size (default 16), or use `--width` and `--height`.
- **Presets:** `--preset desktop|desktop-4k|phone|youtube|github-social|x-header|linkedin-banner|square|story`. These are the wallpaper and social sizes from `runtime/canvas.js`.
- **Look and colour:** `--bg #hex` and `--look dots` (any look, shape looks included).
- **PNG:** `--at 2.5` picks the frame a PNG shows.

## Requirements

- Node 20+.
- [sharp](https://sharp.pixelplumbing.com) and [@napi-rs/canvas](https://github.com/Brooooooklyn/canvas) install as prebuilt binaries.
- Video, GIF and every export except `.cast` and `.png` need `ffmpeg` on your PATH.

## Tests

```bash
npm test -w packages/studio
```

The tests cover the SVG and PNG logos, pictures, ffmpeg clips, the export formats, piece modules and the CLI.
