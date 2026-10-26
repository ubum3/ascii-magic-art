# ascii

The package is named `ascii` and lives in `packages/ui`. It is private and local to this repo: `ascii` on npm is someone else's package, so it can't be published under this name.

Ready-made React and Next.js components built on [`ascii-magic-art-react`](../react/README.md): WebGPU shader scenes played as ASCII, gradient backgrounds with an optional ASCII overlay, and React Bits ports. Each one has its own entry, `ascii/<name>`; there is no root `ascii` entry, so a page loads only the components it imports.

The Lumino brandmark components (`<LuminoDonut>`, `<LuminoSpace>`, `<EdgeOrbit>`, `<LuminoHolo>`) are in their own package, [`lumino-ui`](../lumino-ui/README.md).

## Shader components

These play a WebGPU scene from [`shaders`](../../shaders/README.md) as ASCII, through `AsciiShader`. They are only on their own entries (`ascii/nebula-sky` and the rest), so pages that don't use them never load WebGPU code. `shaders` is an optional peer dependency: install it to use them.

| Component | What it is |
|---|---|
| `<NebulaSky>` | A background: billowing nebula gas, god rays from the top-right corner and drifting motes. Colours: `gas`, `veil`, `core`, `rays`. |
| `<CursorField>` | A background that follows the pointer, even under your content. `variant`: `flow` (dust you plough through), `filings` (iron filings around a magnet), `bloom` (reaction-diffusion that grows where you drag) or `smoke` (smoke from the pointer). Colours: `colorA`, `colorB`. |
| `<AsciiTransition>` | Wraps content. When `show` changes, an ASCII cover closes over the old content, the content swaps, and the cover opens on the new. `effect`: `iris`, `dissolve`, `ripple` or `blinds`. `duration` (1000 ms), `colorA`, `colorB`. |

```tsx
import { NebulaSky } from "ascii/nebula-sky";
import { AsciiTransition } from "ascii/ascii-transition";

<NebulaSky dim={0.1} style={{ height: "100vh" }}><h1>Hello</h1></NebulaSky>

<AsciiTransition show={step} effect="dissolve">{slides[step]}</AsciiTransition>
```

The two backgrounds share `src/shader/ShaderStage.tsx`, exported as `ascii/shader` (lumino-ui's `<LuminoHolo>` uses it too). It fills its container like `AsciiHero`, sizing the grid to the box so nothing is cropped. It takes `cols` (96), `colors` (32), `look` (`dots` by default), `dim`, `opacity`, `bg`, `fit`, `label`, `children` and playback props.

Without WebGPU (and on the server, until it starts), each background plays a clip baked from the same scene. Clips are 80 x 45 cells, 6 s at 12 fps, loaded with a dynamic import only when needed. `baked` forces the clip, for testing. `CursorField`'s `smoke` falls back to `flow`, since smoke is empty without a cursor. `AsciiTransition` has no clip: without WebGPU the content crossfades, and with reduced motion it swaps at once.

After changing a scene, rebake its clips (this needs Chrome or Chromium with WebGPU, via `$CHROME`, the PATH or the macOS app):

```bash
npm run bake -w packages/ui                 # every clip
npm run bake -w packages/ui -- nebula-sky   # one component
```

## Gradient backgrounds

Full-resolution WebGPU gradients from [`shaders`](../../shaders/README.md) that fill their container behind your content. ASCII is off by default. Add `ascii="overlay"` to draw glyphs over the gradient, or `ascii="full"` to show only glyphs. Each one takes **every prop of its shaders/react layer** (colours, `speed`, `blendMode` and the rest), so you can customise them freely. Each has its own entry.

| Component | Layer | Out of the box |
|---|---|---|
| `<PlasmaBackground>` (`ascii/plasma-background`) | `Plasma` | Warped magenta plasma (`colorA`, `colorB`, `density`, `warp`, `intensity`, ...) |
| `<SilkBackground>` (`ascii/silk-background`) | `FlowingGradient` | Liquid silk in four colours (`colorA` to `colorD`, `distortion`, ...) |
| `<MeshBackground>` (`ascii/mesh-background`) | `MeshGradient` | Drifting mesh in indigo, violet, magenta, orange and gold. `colors={[...]}` sets your own palette. `colorA` and `colorB` alone switch to two colours. |
| `<ChromaBackground>` (`ascii/chroma-background`) | `ChromaFlow` over a dark `MeshGradient` | Colour trails the pointer, tinted by the direction it moves (`upColor`, `downColor`, ...). `restA` and `restB` set the drifting base. |

```tsx
import { PlasmaBackground } from "ascii/plasma-background";
import { MeshBackground } from "ascii/mesh-background";

<PlasmaBackground colorA="#00ffa3" colorB="#001a33" speed={0.5} style={{ height: "100vh" }}>
  <h1>Hello</h1>
</PlasmaBackground>

<MeshBackground ascii="overlay" colors={["#001219", "#0a9396", "#e9d8a6"]} cellSize={20} characters="#*+-. " />
```

ASCII options: `characters` (brightest first, default `@%#*+=-:.`), `cellSize` (CSS pixels, default 16), `gamma` (default 0.5, and 0.25 for plasma: lower lifts dark areas to denser glyphs), `fontFamily`, `spacing`, `backdrop` (behind the glyphs in full mode), `asciiBlend` (default `screen`) and `asciiOpacity` (default 0.8, overlay only). There are also `dim`, `label`, `className` and `style`.

`<AsciiOverlay layers={...}>` (`ascii/ascii-overlay`) is what they're built on. Give it any shaders/react layers, such as `<ImageTexture url="..." />`, a `<VideoTexture>` or your own stack, and an `ascii` mode (default `overlay`). It can't capture plain HTML: shaders only sees DOM through `HTMLInCanvas`, which needs a Chrome Canary flag.

Unlike the shader components above, these draw glyphs on the GPU in a real font, with no readback. Without WebGPU the canvas stays transparent and a CSS gradient built from the component's colours shows instead, which is also what the server HTML has. A baked clip wouldn't follow custom colours, so there isn't one. `examples/next-demo` shows them at `/gradients`.

## React Bits

Components from [React Bits](https://reactbits.dev) (MIT + Commons Clause), ported to TypeScript with their CSS inlined as styles, so there's no stylesheet to import. Each one has its own entry. They fill their container, so give it a size.

| Component | What it is |
|---|---|
| `<DarkVeil>` (`ascii/dark-veil`) | A soft glowing veil drawn with WebGL2 that swirls and lights up around the cursor (`color`, `speed`, `sheen`, `glow`, `fade`, `lightMode`, ...). |
| `<GhostFibers>` (`ascii/ghost-fibers`) | Twisting ribbons of glowing fibers with depth of field, bloom and dust, drawn with WebGL2. The cursor pulls the focus (`hoverEffect="focus"`) or parts the fibers (`"part"`), and a click sends a pulse along a ribbon (`glowColor`, `layers`, `twist`, `threads`, `fiberStyle`, `tips`, ...). |
| `<Threads>` (`ascii/threads`) | A bundle of fine threads drawn with WebGL2 that peel apart into waves. `enableMouseInteraction` lets the cursor steer the waves and `parting` moves the threads aside around it (`color`, `accentColor`, `lineCount`, `amplitude`, `angle`, ...). Colours can be CSS or `[r, g, b]` from 0 to 1. |
| `<PixelSnow>` (`ascii/pixel-snow`) | Pixel-art snow drawn with WebGL2, with depth, glow and twinkle. The cursor brushes the flakes aside, and `accumulate` piles them into drifts along the bottom (`variant="snowflake" \| "square" \| "round"`, `density`, `wind`, `pixelSize`, ...). |

```tsx
import { DarkVeil } from "ascii/dark-veil";

<div style={{ width: "100%", height: 600, position: "relative" }}>
  <DarkVeil color="#38bdf8" sheen={1} />
</div>
```

`examples/next-demo` shows them at `/reactbits`.

## Layout

Each component has its own folder in `src/components/`, named like its entry:

```
src/
  components/
    nebula-sky/            a shader component: NebulaSky.tsx, scene.tsx (the <Shader> tree), clip.ts (baked), index.ts (its entry: ascii/nebula-sky)
    ascii-overlay/         AsciiOverlay: shaders layers plus GPU ASCII, used by the *-background folders
    dark-veil/             a React Bits component: DarkVeil.tsx, glsl.ts (its shaders); ghost-fibers/, threads/ and pixel-snow/ (plus sprites.ts) likewise
  shader/ShaderStage.tsx   what the readback shader components share: ascii/shader
scripts/
  bake.mjs                 this package's clips
  bake-clips.mjs           the baking itself, shared with lumino-ui
  mask.mjs                 a logo to a mask module
```

## Adding a component

1. Make `src/components/<name>/` with `<Name>.tsx` starting with `"use client"` and `index.ts` exporting it. Copy `nebula-sky/` for a shader scene, `plasma-background/` for a gradient, or `dark-veil/` for a React Bits port. The `ascii/<name>` entry works on its own.
2. A shader scene needs a `scene.tsx` and a job in `scripts/bake.mjs`, then `npm run bake -w packages/ui -- <name>`.
3. Add tests to `test/ui.test.mjs` and a page to `examples/next-demo`.

To turn a logo into a mask for a piece: `npm run mask -w packages/ui -- logo.svg <out>/mask.ts 96`.

## Develop

```bash
npm run build -w packages/ui   # tsc -> dist/
npm test -w packages/ui        # tests run against dist/, so build first
npm run dev -w packages/ui     # rebuild on save
```

The package depends on `ascii-magic-art-react`, so build that first (`npm run build -w packages/react`).
