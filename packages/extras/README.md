# ascii-magic-art-extras

Pieces made from **data** instead of code. A spec is plain JSON that names a kind and says how to draw it. The same spec plays on the web, in React, in the CLI, and in the Rust and Go terminal packages, which run this exact code in QuickJS and goja. Parity tests check it against Node.

```js
import { fromSpec } from "ascii-magic-art-extras";

const deployed = fromSpec({ kind: "text", text: "DEPLOYED", effect: "scramble" });
const draw = deployed.default();
draw(1.2);                                   // a frame, like any piece
const bar = fromSpec({ kind: "progress", cols: 40 }).default();
bar(0.5, { value: 0.42, label: "Uploading" }); // data kinds take state too
```

| kind | what | state |
|---|---|---|
| `brand` | a logo mask with an entrance (`reveal`, `draw`, `assemble`, `matrix`, `glitch`, `halftone`, `spin3d`, `shimmer`), then an idle (`shimmer`, `still`, `pulse`, `rain`) | none |
| `text` | words in a block font (`typewriter`, `wave`, `rainbow`, `scramble`, `glitch`, `plain`) | none |
| `image` | a picture: palette keys × 8 brightness levels, with `lib/image.js` motions | none |
| `progress` | a bar that eases to its value, with a glint and a label | `{ value, label }` |
| `sparkline` | the last `cols` values as bars in eighths | `{ values, label }` |
| `ticker` | a scrolling marquee: ▲ green, ▼ red | `{ items: [{ label, value, delta }] }` |
| `celebrate` | a check that draws itself, confetti or fireworks, over a message | `{ message, style }` |

Specs usually come from [ama-studio](../studio/README.md): `ama-studio brand logo.svg -o logo.json`. See `src/index.d.ts` for every field.

Also included:

- **`cellsFromPixels(rgba, w, h)` and `buildPalette`:** pixels to cells, using a median-cut palette and brightness levels. Every package uses this one quantiser.
- **`encodeClip`, `decodeClip` and `clipPiece`:** the `.amc` clip format.
- **`mixFrames`, `mergePalettes` and `sequence([a, b], { kind: "melt" })`:** cell-level transitions, and pieces played one after another.

Every kind is deterministic (no `Math.random`, no clock) and draws a frame in well under 1 ms. The tests check every effect for size, determinism and speed:

```bash
npm test -w packages/extras
```

After changing anything here, run `npm run native` in the repo root. That rebuilds the bundle the Rust and Go packages embed, plus their golden frames.

`examples/mark.svg` is a placeholder brandmark, and `examples/mark.json` is its `assemble` spec.
