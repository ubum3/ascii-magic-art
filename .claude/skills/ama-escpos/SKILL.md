---
name: ama-escpos
description: ascii-magic-art-escpos (packages/escpos) - prints pieces and QR codes on 58/80 mm ESC/POS thermal printers (CP437 text or dithered raster), flipbooks, TCP/USB/file transports, plus a PNG emulator and the ama-escpos CLI. Use for "print a receipt", "QR on a receipt printer", "preview an ESC/POS job", "thermal printer flipbook".
---

# ama-escpos: ascii-magic-art on receipt printers

## What it is

Turns any piece, spec, clip or QR code into an ESC/POS job (`Uint8Array`) for 58 mm or 80 mm thermal printers, sends it over TCP, a Linux USB device or to a file, and emulates any job back to a PNG so it can be checked without a printer. Real hardware is untested: rely on the emulator and goldens, and say so when reporting results.

- Path: `packages/escpos/` (`src/index.js`, `src/receipt.js`, `src/encode.js`, `src/text.js`, `src/raster.js`, `src/cp437.js`, `src/emulate.js`, `src/transport.js`, CLI `bin/ama-escpos.js`)
- Package: `ascii-magic-art-escpos`, bin `ama-escpos`
- Depends on `ascii-magic-art-qr`, `ascii-magic-art-studio` (`src/load.js`) and `@napi-rs/canvas`

## Quick start

```js
import fs from "fs";
import { receipt, send, emulate } from "ascii-magic-art-escpos";

const job = await receipt("empty-payment-success", { paper: 58, mode: "text" });
fs.writeFileSync("preview.png", emulate(job, { paper: 58 }).png());
await send(job, "receipt.bin");   // a file; or "tcp://192.168.1.50:9100", "/dev/usb/lp0"
```

## Core API / commands

| Export | Signature |
|---|---|
| `receipt` | `async (src, opts?) => Uint8Array`: one frame |
| `flipbook` | `async (src, opts?) => Uint8Array`: `frames` (8), `every` (1/8 s), `from` (0); each numbered and cut |
| `qrReceipt` | `async (text, opts?) => Uint8Array`: `native`, `ecc`, `size`, `caption`, `title` |
| `send` | `async (bytes, target, { timeout = 10000 }) => { kind: "tcp"\|"device"\|"file", bytes }` |
| `emulate` | `(bytes, { paper, strict = true }) => { width, height, glyphs, canvas, rgba(), png() }` |
| `parse` | `(bytes, { paper, strict }) => { ops, width, height }` |
| Low level | `Job`, `start`, `init`, `cancelKanji`, `codePage`, `align`, `font`, `bold`, `lineSpacing`, `feed`, `cut`, `line`, `raster`, `nativeQr`, `PAPER`, `FONTS`, `textRows`, `invertText`, `SHADES`, `rasterFrame`, `dither`, `inkFromRgba`, `DITHERS`, `encode`, `encodable`, `byteOf`, `charOf`, `HIGH`, `MODES` |

`src` is anything `ama-studio` loads (slug, spec `.json`, clip `.amc`, piece `.js`), a loaded `{ meta, draw }`, or a piece module `{ meta, default }`.

Shared options (defaults): `paper` 58 | 80, `font` `"a"` | `"b"`, `mode` `"text"` | `"raster"`, `at` (1.5, or 0 for stills), `dither` `"floyd"` | `"bayer"` | `"threshold"`, `ink` 0.6, `invert` false, `shade` false, `cut` true, `title`, `look`, `state`.

Paper (`PAPER`): 58 mm = 384 dots, 32 cols font A / 42 font B; 80 mm = 576 dots, 48 / 64. `FONTS`: a = 12x24, b = 9x17 dots.

CLI:
```
ama-escpos <slug|spec.json|clip.amc|piece.js> [options]
ama-escpos --qr "<text>" [options]
  -o, --out TARGET   tcp://host[:9100], /dev/usb/lp0, or a file (default receipt.bin)
  --png FILE         also write the emulator preview
  --paper 58|80  --font a|b  --mode text|raster  --at S
  --frames N --every S --from S   flipbook
  --dither floyd|bayer|threshold  --ink 0..1  --invert  --shade
  --look NAME  --title TEXT  --qr TEXT  --native  --ecc L|M|Q|H  --no-cut
```

## Common tasks

Preview without a printer (CLI):
```sh
ama-escpos spinning-coin --paper 80 --mode raster -o out.bin --png preview.png
```

Flipbook to USB:
```sh
ama-escpos rocket-launch --frames 8 --every 0.25 -o /dev/usb/lp0
```

Payment-link QR, printer-drawn (sharpest):
```sh
ama-escpos --qr "https://pay.example/r/42" --native -o receipt.bin --png preview.png
```

QR in JS with a caption:
```js
const job = await qrReceipt("https://pay.example/r/42", { paper: 80, title: "Scan to pay", caption: "Order 42" });
```

Raster with less fade on small text:
```js
await receipt("checkout-payment-flow", { paper: 80, mode: "raster", ink: 1, dither: "bayer" });
```

Check that a job only uses known commands:
```js
emulate(job, { paper: 58 });               // throws on unknown commands
emulate(job, { paper: 58, strict: false }); // tolerate them
```

## Testing and verification

```sh
cd packages/escpos && npm test                    # node --test (15 tests)
cd packages/escpos && UPDATE_GOLDEN=1 npm test    # rewrite test/golden/* after an intended change
node scripts/validate.mjs                          # repo root: 634/634 pieces pass
```

Tests pin the bytes of seven jobs (`test/golden/golden.json`) and the emulator pixels of the dot-drawn ones (PNGs in `test/golden/` are for eyeballing); read QR codes back with jsQR from emulated text, raster and native jobs on 58 and 80 mm; and cover the CP437 table, text shading, raster banding (`GS v 0`, max 255 rows a band), the ink cap, flipbook cuts, TCP send to a local server, and the strict emulator. Look at the PNG diff before accepting new goldens.

## Rules and gotchas

- Repo rules: additive only; never edit `pieces/`, `lib/`, `runtime/` or `bin/` at the root. Validate stays 634/634.
- Hardware untested: nothing here has been run on a physical printer. Don't claim it works on one; verify with `emulate()` and goldens.
- Every job starts `ESC @`, `FS .` (Kanji off; many clones boot in GB18030), `ESC t 0` (CP437) via `start()`. Keep that order.
- Text mode prints a frame as-is only if it fits the paper's columns and every char is CP437 (`encodable`); otherwise it is resampled and shaded to `" ░▒▓█"`. Ink follows the screen (bright = inked); `invert` swaps.
- Raster ink is capped at 0.6 by default: solid black prints slowly, fades and heats the head. Raise `ink` only for faint small text.
- QR text mode falls back font A, then B, then raster when the code is too wide. QR is inverted so dark modules are inked and paper is the quiet zone. Keep URLs short (version 7 or less).
- `--qr` text is printed on paper: never put card numbers, names or emails in it, nor in `title` / `caption`. Don't log job bytes or receipt contents that carry customer data.
- `/dev/usb/lp0` needs the `lp` group (`EACCES` is reported); TCP defaults to port 9100 with a 10 s timeout.
- The emulator only knows the commands this package writes plus `ESC !` and CR. Add any new command to both `encode.js` and `emulate.js`.
