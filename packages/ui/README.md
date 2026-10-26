# ascii

The package is named `ascii` and lives in `packages/ui`. It is private and local to this repo: `ascii` on npm is someone else's package, so it can't be published under this name.

Fun, ready-made React and Next.js components built on [`ascii-magic-art-react`](../react/README.md). Each one is a single import with no setup, and its first frame is in the server HTML.

| Component | What it is |
|---|---|
| `<LuminoDonut>` | The Lumino brandmark as a glassy solid, tumbling like [donut.c](https://www.a1k0n.net/2011/07/20/donut-math.html), with rainbow edges. 80 x 40 cells, loops every 5.7 s. |
| `<LuminoSpace>` | A background: deep space with a nebula, twinkling dust, and Lumino brandmarks for stars that drift by in parallax, spin and flare, plus a shooting brandmark every 20 s. Fills its container behind your content. 160 x 56 cells, loops every 120 s. |
| `<EdgeOrbit>` | A background: the night Earth from low orbit, city lights below and Cloudflare-orange requests arcing city to city, drawn as a halftone, with a white Lumino brandmark tilted in the top-right sky, twinkling like a star. Ported from ascii.rest's "edge orbit" (by bas3line, MIT). Fills its container. 200 x 100 square cells, loops every 24 min. Square cells are never prerendered, so it shows its `bg` until the browser draws the first frame. |

## Use

```tsx
// app/page.tsx: a Server Component is fine, the component is "use client" itself
import { LuminoDonut } from "ascii";

export default function Page() {
  return <LuminoDonut size={12} bg="#0b0b10" />;
}

// A background: give it a height, put your content inside
import { LuminoSpace } from "ascii";

<LuminoSpace dim={0.15} style={{ height: "100vh" }}>
  <h1>Hello</h1>
</LuminoSpace>
```

Each component also has its own entry, `ascii/<name>`, e.g. `import { LuminoDonut } from "ascii/lumino-donut"`.

`LuminoDonut` takes all of `AsciiPlayer`'s props: `size`, `speed`, `paused`, `still`, `bg`, `look`, `chars`, `mono`, `maxFps`, `label` and the rest. `LuminoSpace` and `EdgeOrbit` take all of `AsciiHero`'s: `fit` (`cover` by default), `dim`, `opacity`, `bg` (`#05060f` and `#04060c` by default), `speed`, `look`, `children` and the rest. It is decoration, hidden from screen readers, unless you give it a `label`. Playback pauses off screen, and visitors who prefer reduced motion get a still frame.

`examples/next-demo` shows them at `/lumino` and `/space`.

## Without React

`ascii/pieces` has the pieces on their own, as `{ meta, default }` modules: `luminoDonut`, `luminoSpace`, and their `LUMINO_DONUT_PERIOD` and `LUMINO_SPACE_PERIOD` (one loop, in seconds).

```js
import { luminoDonut } from "ascii/pieces";
const draw = luminoDonut.default();
draw(1.5).text; // one 80 x 40 frame
```

## Layout

Each component has its own folder in `src/components/`, named like its entry:

```
src/
  index.ts                 every component
  pieces.ts                every piece, no React
  components/
    lumino-donut/
      index.ts             the component's entry: ascii/lumino-donut
      LuminoDonut.tsx      the "use client" wrapper around AsciiPlayer
      piece.ts             the piece (definePiece)
      mask.ts              its assets, here the brandmark shape
    lumino-space/          the background (it borrows lumino-donut's mask)
```

## Adding a component

1. Make `src/components/<name>/` with `piece.ts` (written with `definePiece` from `ascii-magic-art-react/kit`), `<Name>.tsx` starting with `"use client"`, and `index.ts` exporting both. Copy `lumino-donut/` as a start. Keep `draw(t)` pure in `t`, so the server and the browser draw the same first frame. The first frame goes in the server HTML only when that HTML is at most 48 KB; for big grids, keep colour changes few (each one is a span).
2. Export the folder from `src/index.ts`, and its piece from `src/pieces.ts`. The `ascii/<name>` entry works on its own.
3. Add tests to `test/ui.test.mjs` and a page to `examples/next-demo`.

To turn a logo into a mask for a piece: `npm run mask -w packages/ui -- logo.svg src/components/<name>/mask.ts 96`.

## Develop

```bash
npm run build -w packages/ui   # tsc -> dist/
npm test -w packages/ui        # tests run against dist/, so build first
npm run dev -w packages/ui     # rebuild on save
```

The package depends on `ascii-magic-art-react`, so build that first (`npm run build -w packages/react`).
