---
name: ama-qr
description: ascii-magic-art-qr (packages/qr) - an animated QR code piece that settles into a scannable half-block still, also the extras "qr" kind. Use for "animated QR code", "payment link QR in the terminal", "QR on a receipt", "QR entrance effect", or when a QR frame stops scanning.
---

# ama-qr: animated, scannable QR codes

## What it is

A QR code as an ascii-magic-art piece. It plays an entrance (`assemble`, `reveal`, `matrix`, `glitch`) and from `settle` seconds (default 1.5) on draws exactly the static code in half blocks (`▀ ▄ █` and space, two modules a cell). The same code is the `qr` kind in `ascii-magic-art-extras`, so a JSON spec plays in React, `ama-studio`, Rust and Go.

- Path: `packages/qr/` (entry `src/index.js`, the spec kind in `src/kind.js`, types in `src/index.d.ts`)
- Package: `ascii-magic-art-qr` (exports `.` and `./kind`)
- Encoder: Project Nayuki's qrcodegen, vendored in `src/vendor/qrcodegen.js`

## Quick start

```js
import { qrPiece, qrFrame } from "ascii-magic-art-qr";

const piece = qrPiece("https://pay.example/r/42", { effect: "assemble", brand: "#635bff" });
const draw = piece.default();
draw(0.5);  // mid-entrance (does NOT scan)
draw(2);    // the exact code, from meta.qr.settle on

qrFrame("https://pay.example/r/42").text;  // the settled code as text
```

## Core API

| Export | Signature | Notes |
|---|---|---|
| `qrPiece` | `(text, opts?) => { meta, default }` (frozen) | A piece module. Still from frame 0 when `still`, `reducedMotion`, or the browser prefers reduced motion. `console.warn` above version 7 unless `warn: false`. |
| `qrFrame` | `(text, opts?) => { text, color, palette, cols, rows, qr }` | The settled still frame. |
| `qrSpec` | `(text, opts?) => { kind: "qr", text, ... }` | Plain JSON spec; `brand` becomes `accent`. |
| `qr` | `(spec) => { meta, create }` | The extras kind; `spec.text` or `spec.url`; throws `qr: needs text (or url)`. |
| `qrMatrix` | `(text, { ecc?, version?, boost? }) => { size, version, ecc, dark(x, y) }` | Raw module matrix. |
| `luminance` | `(hex) => number` | WCAG relative luminance of `#rrggbb`. |
| `QR_EFFECTS`, `QR_ECC` | constants | `["assemble","reveal","matrix","glitch","none"]`; `{ L, M, Q, H }`. |

Options (`QrOptions`): `effect` (default `assemble`, `none` = still), `ecc` (`M`, boosted for free when it fits), `version` (minimum, 1-40), `quiet` (min and default 4), `light` (`#f4f4f5`), `dark` (`#09090b`), `accent`/`brand`, `ghost`, `settle` (1.5), `logo`, `still`, `fps` (30), `slug`, `name`, `note`.

`meta.qr` is `{ version, ecc, size, quiet, settle, dark, light }`; `meta.category` is `"extras"`.

## Common tasks

Still code for a terminal or log-free display:
```js
const { text, cols, rows, qr } = qrFrame(url, { ecc: "Q" });
```

Extras spec (React `<AsciiSpec>`, studio, Rust/Go hosts):
```json
{ "kind": "qr", "text": "https://pay.example/r/42", "effect": "matrix" }
```
```sh
ama-studio play qr.json
ama-studio export qr.json -o qr.png --at 2
```

Centre logo (forces ECC H; label up to 12 chars, max 15% of modules):
```js
qrPiece("https://pay.example/r/merchant-onboarding-12345", { logo: "PAY" });
```

Respect reduced motion outside the browser:
```js
qrPiece(url, { reducedMotion: true });   // or { still: true } / { effect: "none" }
```

Brand colours with a safe contrast:
```js
qrPiece(url, { brand: "#635bff", light: "#ffffff", dark: "#000000" });
```

Raw matrix (e.g. another renderer; `ascii-magic-art-escpos`'s emulator uses this):
```js
import { qrMatrix } from "ascii-magic-art-qr";
const m = qrMatrix("PAY-42", { ecc: "H" }); m.dark(0, 0); // true (finder pattern)
```

## Testing and verification

```sh
cd packages/qr && npm test        # node --test "test/*.test.mjs" (58 tests)
node scripts/validate.mjs          # from the repo root: must print 634/634 pieces pass
```

`test/qr.test.mjs` round-trips through jsQR: `test/render.js` draws frames with `runtime/canvas.js` `renderTo` on `@napi-rs/canvas` (the same renderer as the web player and `ama-studio export`) and decodes with `jsQR(..., { inversionAttempts: "dontInvert" })`. Covered: versions 1-10 at every ECC level; every effect settles to exactly `qrFrame` at t = 1.5, 1.6, 3, 60 and decodes in colour and as mono text; mid-entrance frames (t = 0.15, 0.5, 0.75) must NOT decode; determinism and exact `cols x rows`; quiet zone; contrast; reduced motion; logo; version-7 warning; `qrSpec` JSON shape. Any change to drawing must keep these green.

## Rules and gotchas

Repo rules:
- Additive only. Never edit `pieces/`, `lib/`, `runtime/` or `bin/` at the repo root; build on them from `packages/`.
- `node scripts/validate.mjs` must stay at 634/634.
- Do not encode card numbers, names, emails or other personal data into a QR; use a short opaque link (`https://pay.example/r/42`). Never log the payload of a payment QR.

Scannability (enforced in `src/kind.js`, keep it that way):
- The frame inks the **light** modules and the quiet zone; dark modules are the background. Show it on a background at least as dark as `dark`. A light terminal theme inverts it and many scanners refuse it.
- `luminance(dark)` must be at most a quarter of `luminance(light)`, else `qr()` throws `too close`.
- Quiet zone is at least 4 modules and always drawn; `quiet: 1` is silently raised to 4.
- From `settle` on every frame is identical to the still: no idle shimmer.
- `logo` with `ecc` other than `H` throws `needs ecc H`; a label over 15% throws.
- Above version 7 the code is wider than 48 columns (too wide for 80 mm receipts and narrow terminals). Keep text short.
- Half-block cells are about 1.2 wide to 1 tall; terminals with extra line spacing stripe the code.
- Deterministic: no `Math.random` or clock in `kind.js`, so Node, QuickJS and goja draw the same frames. Keep it plain ES2017 once bundled.
