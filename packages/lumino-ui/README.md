# lumino-ui

The package is named `lumino-ui` and lives in `packages/lumino-ui`. It is private and local to this repo.

Lumino brandmark components for React and Next.js, built on [`ascii-magic-art-react`](../react/README.md) and, for `<LuminoHolo>`, on the shader stage in [`ascii`](../ui/README.md). Each one is a single import with no setup, and its first frame is in the server HTML.

| Component | What it is |
|---|---|
| `<LuminoDonut>` | The Lumino brandmark as a glassy solid, tumbling like [donut.c](https://www.a1k0n.net/2011/07/20/donut-math.html), with rainbow edges. 80 x 40 cells, loops every 5.7 s. |
| `<LuminoSpace>` | A background: deep space with a nebula, twinkling dust, and Lumino brandmarks for stars that drift by in parallax, spin and flare, plus a shooting brandmark every 20 s. Fills its container behind your content. 160 x 56 cells, loops every 120 s. |
| `<EdgeOrbit>` | A background: the night Earth from low orbit, city lights below and Cloudflare-orange requests arcing city to city, drawn as a halftone, with a white Lumino brandmark tilted in the top-right sky, twinkling like a star. Ported from ascii.rest's "edge orbit" (by bas3line, MIT). Fills its container. 200 x 100 square cells, loops every 24 min. Square cells are never prerendered, so it shows its `bg` until the browser draws the first frame. |
| `<LuminoHolo>` (`lumino-ui/lumino-holo`) | The Lumino brandmark as holographic foil with glitter and split colour edges, a WebGPU scene played as ASCII. `hueShift`, `sparkle`, `aberration`. |
| `<LuminoGlassMark>` (`lumino-ui/lumino-glass-mark`) | The liquid-glass brandmark from the LuminoChrome background on its own: a sized, transparent WebGL logo whose top waves, reflects the brand gradient, catches a light sweep and tilts toward the pointer. |

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

## LuminoGlassMark

`<LuminoGlassMark>` is the bevelled chrome brandmark that rises out of `<LuminoChrome>`, cut out of the sea and drawn on a transparent background, so it sits on any page like a logo. It is on its own entry, `lumino-ui/lumino-glass-mark`, and needs WebGL2; the server HTML (and the look without WebGL) is the flat mark in the brand gradient, and the glass fades in over it.

```tsx
import { LuminoGlassMark } from "lumino-ui/lumino-glass-mark";

<LuminoGlassMark size={320} />
```

Props: `size` (the square box, px or any CSS length; 240), `ripple` (how much the surface moves, 0 to 1; 1), `rings` (the rippled metal that hugs the mark in LuminoChrome, 0 for just the mark; 1), `tilt` (how far reflections follow the pointer; 1), `glow` (1), `paused`, `speed`, `quality` (1), `dpr` (2), and `label` (`"Lumino"`; `""` makes it decoration). It pauses off screen and draws one still frame for reduced motion.

## Backgrounds

24 full-bleed Lumino brandmark backgrounds for sign-in pages and heroes, glassy and luminous, in the lumino.io palette (peach, coral, wine, plum, indigo, blue and lavender on `#111013`). Each one fills its container, keeps the middle calm for a centred card, and puts your content on top:

```tsx
import { LuminoRandomBackground } from "lumino-ui/backgrounds";

// A different background on every load, never the same one twice in a row in a tab.
<div style={{ position: "fixed", inset: 0 }}>
  <LuminoRandomBackground dim={0.35}>
    <SignInCard />
  </LuminoRandomBackground>
</div>

// Or one of them, by its entry:
import { PillarStage } from "lumino-ui/pillar-stage";
<PillarStage dim={0.3} style={{ height: "100vh" }}><SignInCard /></PillarStage>
```

Every background takes `children`, `dim` (darkens the middle, 0 to 1), `paused`, `speed`, `quality` (render scale), `dpr` (default cap 1.5), `className` and `style`, plus its own props. The server HTML is a static CSS version of the look; the animation fades in over it once it draws. They pause off screen and in hidden tabs, show one still frame with reduced motion, and keep the CSS look without WebGL. Each is on its own `lumino-ui/<id>` entry and loads only when used: `LuminoRandomBackground` loads just the one it picks (`include`, `exclude`, `pick` and `onPick` narrow or pin it).

| id | Name | By |
|---|---|---|
| `lumino-aura` | Aurora curtains with the mark as a rim of glass light (the reference background) | cd |
| `lumino-glyphs` | The portal's GradientASCII: brand gradient as glyphs, the mark as a glyph, amounts typed over it | cd |
| `dither-lens` | Dithered brand light, smooth and glowing through a frosted-glass mark | cd |
| `signal-rain` | Dim falling digits that ignite warm inside the mark | cd |
| `halftone-tide` | A dot grid under tides of brand light, the mark surfacing in brighter dots | cd |
| `edge-orbit` | ASCII: the night Earth from orbit, a brandmark star in the sky | cd |
| `lumino-space` | ASCII: deep space with brandmark stars | cd |
| `glass-prism-rays` | A glass mark lit from behind, prismatic shafts down the sides | dd |
| `apex-burst` | A prismatic burst from the mark's heart, cut into rays by its shapes | dd |
| `arc-conduit` | Electric arcs crawling a big glass mark and jumping its gaps | dd |
| `pillar-stage` | The blades as light pillars meeting in a star over the card, the base a horizon | dd |
| `globe-dawn` | The lumino.io dotted globe, the mark rising off its limb like a sun | 97 |
| `accretion-lens` | The mark as a black hole: photon ring, accretion disk, lensed space | 97 |
| `brandmark-galaxy` | A spiral galaxy whose nucleus is the mark in stars | 97 |
| `nebula-constellation` | Stars drift together and draw the mark in glass lines, then re-form elsewhere | 97 |
| `ferro-bloom` | Glossy ferrofluid spiking along the mark, its magnet | 36 |
| `field-lines` | Magnetic field lines between the mark's poles, with pulses along them | 36 |
| `silk-wake` | Silk ribbons parting around an invisible mark | 36 |
| `ether-imprint` | A fluid sim the mark is stamped into every 8 s, blooming and curling apart | 36 |
| `lumino-chrome` | A liquid-chrome sea with the mark rising out of the metal | b3 |
| `lumino-orb` | A glass ball lens with the mark turning inside, iridescent rim | b3 |
| `lumino-frost` | The mark as three frosted-glass slabs framing the card (CSS glass) | b3 |
| `lumino-shards` | Glass shards cut from the mark, orbiting the card and reassembling | b3 |
| `lumino-fibers` | GhostFibers in the brand gradient drawn over in ASCII glyphs, with the brandmark as one of the glyphs as in `lumino-glyphs` (`ascii`, `cellSize`, `asciiOpacity`, `characters`, `markChance`, `fibers`) | b4 |

`examples/next-demo` shows them at `/lumino-bg` (gallery), `/lumino-bg/<id>?card=1&dim=0.4` (one, full screen), `/lumino-bg/perf` (frame times, with GPU timer queries where the browser has them) and `/sign-in` (a mock sign-in page with a random one).

### Making one

`lumino-ui/backgrounds` and `lumino-ui/brand` hold the shared parts: `BackgroundFrame` (fallback, fade-in, dim, children), `useGLScene` / `use2DScene` (sizing, DPR cap, pausing, reduced motion, pointer), WebGL2 helpers (`link`, `drawFullscreen`, `paletteTexture`, `markSDFTexture`, `BRAND_GLSL`), and the brand (`LUMINO_COLORS`, `LUMINO_GRADIENT`, `BRANDMARK`, `brandmarkSDF`, `brandmarkPoints`, `brandmarkOutline`, `<Brandmark>`). Copy `src/components/lumino-aura/`, add an entry to `src/backgrounds/registry.ts`, and `test/backgrounds.test.mjs` checks it loads and renders on the server. To look at it without a browser, run the demo and `npm run shots -w packages/lumino-ui -- --url http://localhost:3000 [--card] <id>`, which writes headless Chromium screenshots to `.shots/`.

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
    lumino-glass-mark/     LuminoChrome's mark on its own: LuminoGlassMark.tsx, glsl.ts (it borrows lumino-chrome's smoothed SDF)
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
