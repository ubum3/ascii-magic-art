# ascii-magic-art-qr

A QR code as an ascii-magic-art piece. It makes an entrance (`assemble`, `reveal`, `matrix` or `glitch`) and settles into a scannable code drawn in half blocks, two modules a cell (`▀ ▄ █` and space).

```js
import { qrPiece, qrFrame } from "ascii-magic-art-qr";

const piece = qrPiece("https://pay.example/r/42", { effect: "assemble", brand: "#635bff" });
const draw = piece.default();
draw(0.5);  // mid-entrance
draw(2);    // the exact code, from `settle` (1.5 s) on

qrFrame("https://pay.example/r/42").text;  // the settled code as text
```

The same thing is the `qr` kind in `ascii-magic-art-extras`, so a JSON spec plays in React (`<AsciiSpec>`), in `ama-studio`, and in the Rust and Go packages:

```json
{ "kind": "qr", "text": "https://pay.example/r/42", "effect": "matrix" }
```

```sh
ama-studio play qr.json
ama-studio export qr.json -o qr.png --at 2
```

## Options

| Option | Default | |
|---|---|---|
| `effect` | `assemble` | `assemble`, `reveal`, `matrix`, `glitch`, or `none` for a still code |
| `ecc` | `M` | `L`, `M`, `Q`, `H`. Raised for free when the data still fits the same version |
| `version` | 1 | the smallest QR version to use |
| `quiet` | 4 | quiet zone in modules; never less than 4 |
| `light` | `#f4f4f5` | the light modules and the quiet zone |
| `dark` | `#09090b` | the background you will show it on |
| `brand` / `accent`, `ghost` | greens | entrance colours |
| `settle` | 1.5 | seconds until the code is exact and still |
| `logo` | | a short label in a box in the centre (needs ECC `H`) |
| `still` | | no entrance at all |

## Scannability rules

- The frame inks the **light** modules and the quiet zone; the dark modules are the background under it. Show it on a background at least as dark as `dark`: a dark terminal, the web player, an export with `--bg` dark. On a light terminal theme it shows inverted and many scanners refuse it.
- `dark` must be at most a quarter of `light`'s luminance, or `qr()` throws.
- The quiet zone is at least 4 modules and always drawn.
- From `settle` on, every frame is exactly the static code: no idle shimmer. `qrPiece` in a browser that prefers reduced motion is still from the first frame; elsewhere pass `still: true` (players that honour reduced motion draw t = 0).
- A centre logo needs ECC `H` and may cover at most 15% of the modules; it throws otherwise.
- Above version 7 the code is wider than 48 columns, so `qrPiece` warns. Keep URLs short for terminals and 80 mm receipts.
- Half-block modules come out about 1.2 wide to 1 tall in a typical monospace font. Phones and jsQR read that fine; a terminal with extra line spacing breaks the code into stripes.

## Tests

`npm test` draws frames with `runtime/canvas.js` (the web player's and `ama-studio export`'s renderer) on `@napi-rs/canvas` and reads them back with [jsQR](https://github.com/cozmo/jsQR): versions 1 to 10 at every ECC level, every effect in the original look and as mono text, a logo, and a check that frames mid-entrance do **not** decode.

## Credits

The encoder is Project Nayuki's [QR Code generator library](https://www.nayuki.io/page/qr-code-generator-library) (MIT), vendored in `src/vendor/qrcodegen.js`.
