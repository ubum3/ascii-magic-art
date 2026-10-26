# lumino-ui

The package is named `lumino-ui` and lives in `packages/lumino-ui`. It is private and local to this repo.

Lumino brandmark components for React and Next.js, built on [`ascii-magic-art-react`](../react/README.md) and, for `<LuminoHolo>`, on the shader stage in [`ascii`](../ui/README.md). Each one is a single import with no setup, and its first frame is in the server HTML.

| Component | What it is |
|---|---|
| `<LuminoDonut>` | The Lumino brandmark as a glassy solid, tumbling like [donut.c](https://www.a1k0n.net/2011/07/20/donut-math.html), with rainbow edges. 80 x 40 cells, loops every 5.7 s. |
| `<LuminoSpace>` | A background: deep space with a nebula, twinkling dust, and Lumino brandmarks for stars that drift by in parallax, spin and flare, plus a shooting brandmark every 20 s. Fills its container behind your content. 160 x 56 cells, loops every 120 s. |
| `<EdgeOrbit>` | A background: the night Earth from low orbit, city lights below and Cloudflare-orange requests arcing city to city, drawn as a halftone, with a white Lumino brandmark tilted in the top-right sky, twinkling like a star. Ported from ascii.rest's "edge orbit" (by bas3line, MIT). Fills its container. 200 x 100 square cells, loops every 24 min. Square cells are never prerendered, so it shows its `bg` until the browser draws the first frame. |
| `<LuminoHolo>` (`lumino-ui/lumino-holo`) | The Lumino brandmark as holographic foil with glitter and split colour edges, a WebGPU scene played as ASCII. `hueShift`, `sparkle`, `aberration`. |

## Use

```tsx
// app/page.tsx: a Server Component is fine, the component is "use client" itself
import { LuminoDonut } from "lumino-ui";

export default function Page() {
  return <LuminoDonut size={12} bg="#0b0b10" />;
}

// A background: give it a height, put your content inside
import { LuminoSpace } from "lumino-ui";

<LuminoSpace dim={0.15} style={{ height: "100vh" }}>
  <h1>Hello</h1>
</LuminoSpace>
```

Each component also has its own entry, `lumino-ui/<name>`, e.g. `import { LuminoDonut } from "lumino-ui/lumino-donut"`.

`LuminoDonut` takes all of `AsciiPlayer`'s props: `size`, `speed`, `paused`, `still`, `bg`, `look`, `chars`, `mono`, `maxFps`, `label` and the rest. `LuminoSpace` and `EdgeOrbit` take all of `AsciiHero`'s: `fit` (`cover` by default), `dim`, `opacity`, `bg` (`#05060f` and `#04060c` by default), `speed`, `look`, `children` and the rest. It is decoration, hidden from screen readers, unless you give it a `label`. Playback pauses off screen, and visitors who prefer reduced motion get a still frame.

`examples/next-demo` shows them at `/lumino`, `/space`, `/orbit` and `/shaders`.

## LuminoHolo

`<LuminoHolo>` plays a WebGPU scene from [`shaders`](../../shaders/README.md) through `ascii/shader` (the `ShaderStage` that the `ascii` shader components share). It is only on its own entry, `lumino-ui/lumino-holo`, never the root `lumino-ui` entry, so pages that don't use it never load WebGPU code. `shaders` is an optional peer dependency: install it to use it.

It takes `ShaderStage`'s props: `cols` (96), `colors` (32), `look` (`dots` by default), `fit` (`contain` by default), `dim`, `opacity`, `bg`, `label`, `children` and playback props. Without WebGPU (and on the server, until it starts) it plays a clip baked from the same scene: 80 x 45 cells, 6 s at 12 fps, loaded with a dynamic import only when needed. `baked` forces the clip, for testing.

After changing its scene or the brandmark mask, rebake the clip and logo (this needs Chrome or Chromium with WebGPU, via `$CHROME`, the PATH or the macOS app):

```bash
npm run bake -w packages/lumino-ui   # lumino-holo/clip.ts and lumino-holo/logo.ts
```

## Without React

`lumino-ui/pieces` has the pieces on their own, as `{ meta, default }` modules: `luminoDonut`, `luminoSpace`, `edgeOrbit`, and their `LUMINO_DONUT_PERIOD`, `LUMINO_SPACE_PERIOD` and `EDGE_ORBIT_PERIOD` (one loop, in seconds).

```js
import { luminoDonut } from "lumino-ui/pieces";
const draw = luminoDonut.default();
draw(1.5).text; // one 80 x 40 frame
```

## Layout

Each component has its own folder in `src/components/`, named like its entry:

```
src/
  index.ts                 every piece component (not LuminoHolo)
  pieces.ts                every piece, no React
  components/
    lumino-donut/
      index.ts             the component's entry: lumino-ui/lumino-donut
      LuminoDonut.tsx      the "use client" wrapper around AsciiPlayer
      piece.ts             the piece (definePiece)
      mask.ts              its assets, here the brandmark shape
    lumino-space/          the background (it borrows lumino-donut's mask)
    edge-orbit/            the orbit background (it borrows the mask too)
    lumino-holo/           the shader component: LuminoHolo.tsx, scene.tsx (the <Shader> tree), clip.ts (baked), logo.ts (the mask as a PNG)
```

## Adding a component

1. Make `src/components/<name>/` with `piece.ts` (written with `definePiece` from `ascii-magic-art-react/kit`), `<Name>.tsx` starting with `"use client"`, and `index.ts` exporting both. Copy `lumino-donut/` as a start. Keep `draw(t)` pure in `t`, so the server and the browser draw the same first frame. The first frame goes in the server HTML only when that HTML is at most 48 KB; for big grids, keep colour changes few (each one is a span).
2. Export the folder from `src/index.ts`, and its piece from `src/pieces.ts`. The `lumino-ui/<name>` entry works on its own.
3. Add tests to `test/lumino-ui.test.mjs` and a page to `examples/next-demo`.

To turn a logo into a mask for a piece: `npm run mask -w packages/lumino-ui -- logo.svg src/components/<name>/mask.ts 96`.

## Develop

```bash
npm run build -w packages/lumino-ui   # tsc -> dist/
npm test -w packages/lumino-ui        # tests run against dist/, so build first
npm run dev -w packages/lumino-ui     # rebuild on save
```

The package depends on `ascii-magic-art-react` and `ascii`, so build those first (`npm run build -w packages/react && npm run build -w packages/ui`).
