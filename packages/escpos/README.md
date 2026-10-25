# ascii-magic-art-escpos

Print ascii-magic-art pieces and QR codes on ESC/POS thermal receipt printers, 58 mm and 80 mm. An emulator draws any job back to a PNG, so you can check it without a printer.

```sh
ama-escpos spinning-coin --paper 80 --mode raster -o tcp://192.168.1.50:9100
ama-escpos rocket-launch --frames 8 --every 0.25 -o /dev/usb/lp0      # a flipbook
ama-escpos --qr "https://pay.example/r/42" --native -o receipt.bin --png preview.png
```

```js
import { receipt, flipbook, qrReceipt, send, emulate } from "ascii-magic-art-escpos";

const job = await receipt("empty-payment-success", { paper: 58, mode: "text" });
fs.writeFileSync("preview.png", emulate(job, { paper: 58 }).png());
await send(job, "tcp://192.168.1.50:9100");
```

`receipt`, `flipbook` and `qrReceipt` return the job as a `Uint8Array`. They take anything `ama-studio` plays: a slug, a spec `.json`, a clip `.amc`, a piece module `.js`, or a loaded `{ meta, draw }`.

## Paper

| Paper | Dots | Font A (12 x 24) | Font B (9 x 17) |
|---|---|---|---|
| 58 mm | 384 | 32 columns | 42 columns |
| 80 mm | 576 | 48 columns | 64 columns |

## Text mode (default)

Every job starts with `ESC @` (initialise), then `FS .` (Kanji off, since many clones boot in GB18030), then `ESC t 0` (code page 437). It then sets line spacing to the font's height, so block rows join up. CP437 has the glyphs that matter:

| Glyph | `░` | `▒` | `▓` | `█` | `▄` | `▌` | `▐` | `▀` | `■` | box drawing |
|---|---|---|---|---|---|---|---|---|---|---|
| Byte | B0 | B1 | B2 | DB | DC | DD | DE | DF | FE | B3 to DA |

A frame that fits the paper and is all CP437 prints as it is: half-block pictures, QR codes, box drawing, text. Any other frame is resampled to the paper's columns and shaded. Each cell's darkness (`densityGrid` in `runtime/glyphs.js`) becomes one of `" ░▒▓█"`. Ink follows the screen, so what is bright on a dark screen is inked. `--invert` swaps that.

## Raster mode

The frame is drawn exactly as the web player draws it (`runtime/canvas.js` `renderTo` on `@napi-rs/canvas`), at the paper's width in dots. It is then dithered (Floyd–Steinberg, an 8 x 8 Bayer pattern, or a threshold) and sent as `GS v 0` in bands of at most 255 rows. Ink is capped at 60% by default (`--ink`), because solid black prints slowly, fades and heats the head. Pieces that are mostly small text come out faint at that cap, so use text mode or `--ink 1` for those.

## QR codes

- `--native` sends the printer's own `GS ( k` (model 2). The printer draws it, and it is the sharpest option.
- Otherwise the code is the settled `ascii-magic-art-qr` code, inverted so the dark modules are inked and the paper is the quiet zone. In text mode it uses font A, then font B if A is too narrow, then raster if both are.

## Flipbook

`--frames N --every S` prints N frames, S seconds apart. Each frame is numbered and followed by a partial cut (`GS V 66`), or by a dashed rule with `--no-cut`. Stack and staple the frames, then flip.

## Sending

| Target | |
|---|---|
| `tcp://host[:port]` | raw TCP, port 9100 by default |
| `/dev/usb/lp0` | a USB printer on Linux (needs the `lp` group) |
| anything else | a file |

## Emulator

`emulate(bytes, { paper })` returns `{ width, height, glyphs, png(), rgba() }`. It understands the commands this package writes, plus `ESC !` and CR, and throws on anything else unless you pass `strict: false`. Blocks, shades, raster images, QR codes and cut marks are drawn dot by dot; other characters use the canvas's monospace font.

## Tests

`npm test` pins the bytes of seven jobs and the emulator pixels of the dot-drawn ones; the PNGs in `test/golden/` are for looking at. It also reads QR codes back from emulated text, raster and native jobs with jsQR on both paper widths, and covers the CP437 table, raster banding, the ink cap, the flipbook cuts, TCP sending and the strict emulator. `UPDATE_GOLDEN=1 npm test` rewrites the goldens.
