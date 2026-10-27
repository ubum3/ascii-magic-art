---
name: ama-ui
description: ascii (packages/ui) - drop-in React/Next.js components built on ascii-magic-art-react: WebGPU shader scenes played as ASCII with baked fallbacks (NebulaSky, CursorField (pointer-stirred), AsciiTransition (wipes between content)) and their shared ShaderStage (ascii/shader), customisable gradient backgrounds with an optional GPU ASCII overlay (PlasmaBackground, SilkBackground, MeshBackground, ChromaBackground, AsciiOverlay), and React Bits components (DarkVeil, GhostFibers, Threads, PixelSnow) ported to TypeScript. Use to "add a shader background", "make a shader into a component", "rebake the shader clips", "plasma/gradient background", "ASCII overlay on a gradient or image", or "add a React Bits component". The Lumino brandmark components (LuminoDonut, LuminoSpace, EdgeOrbit, LuminoHolo, LuminoGlassMark and the backgrounds) are in packages/lumino-ui: see ama-lumino-ui.
---

# ama-ui: drop-in shader, gradient and React Bits components

## What it is

Lives in `packages/ui`. package `ascii` (private, local to this repo: `ascii` on npm is an unrelated package, so never publish it), depends on `ascii-magic-art-react`; peers `react`, `react-dom`, optional `shaders`. Built with `tsc` to `dist/`. There is no root entry (a test checks): every component is on `ascii/<name>`. The Lumino brandmark components moved to `packages/lumino-ui` (ama-lumino-ui), which uses `ascii/shader`.

## Exports

| entry | exports |
|---|---|
| `ascii/<name>` | one component folder: `ascii/nebula-sky`, `ascii/cursor-field` (+ `CURSOR_FIELD_VARIANTS`), `ascii/ascii-transition` (+ `ASCII_TRANSITION_EFFECTS`); each also exports its scene component |
| `ascii/shader` | `ShaderStage`, `ShaderStageProps`, `ClipLoader` (src/shader/ShaderStage.tsx) |

## Shader components

`shaders` (optional peer) scenes run through `AsciiShader` (ascii-magic-art-react/shader). Each is on its own entry only, so pages without them never load WebGPU code.

- `src/shader/ShaderStage.tsx`: shared stage. A container-query box like AsciiHero. A ResizeObserver sets `rows = cols * h / w` (square cells) so the art fills the box exactly, with font size `100cqw / (cols * 0.602)`. Without WebGPU (`onUnavailable`), or with `baked`, it plays the baked clip through AsciiHero (decoded from base64 with `loadClip`; the dynamic `import("./clip.js")` keeps it out of the main bundle). Shaders read the cursor from `window` and check it against the canvas rect, so content on top doesn't block it, and AsciiShader's `interactive` isn't needed.
- `<name>/scene.tsx`: the `<Shader>` tree as a component with colour props. The component and the bake both use it. Defaults are what's baked.
- `scripts/bake.mjs` (`npm run bake -w packages/ui [-- name]`) calls `bakeClips` in `scripts/bake-clips.mjs` (shared with lumino-ui), which bakes each JOB with studio's `bakeFrames` (headless Chrome, `--enable-unsafe-webgpu`) for 7 s, crossfades the last second into the first, and writes `clip*.ts` (80 x 45, 12 fps, 24 colours). The flow clip is the biggest, about 240 KB.
- Tuning: preview a scene with `ama-studio bake x.jsx -o x.amc` then `ama-studio export x.amc -o x.png --look dots`. The default look shows dark pixels as thin ▁ bars, so judge with `dots`. Particles need `size` 3-4 to survive downsampling to cells. Shape effects (Nebula, Holographic) default to a sphere, so `shape={{ type: "roundedRectSDF", radius: 1.2, height: 1.2 }}` fills the canvas. Logo masking (as in lumino-ui's LuminoHolo) uses a hidden **RGBA** PNG ImageTexture (`id`, `visible={false}`) and `maskSource` + `maskType="alpha"`.
- AsciiTransition: every wipe's `progress` is the share wiped away (0 is a full cover); `invert` flips the shape, not the direction. In is inverted with progress 1 to 0, out is 0 to 1, and the swap happens at full cover. The overlay has no `bg`, so transparent pixels are empty cells. The old children are held in a ref during "in".

## Gradient backgrounds (GPU ASCII)

`components/ascii-overlay/AsciiOverlay.tsx`: a `<Shader>` that fills the box, with a CSS `fallback` under it (WebGPU missing means a transparent canvas, so the fallback shows; it's also the SSR look). `ascii` is `off` (just `layers`), `overlay` (layers, then `<Ascii blendMode opacity>{layers}</Ascii>`, so the layers render twice) or `full` (`<SolidColor backdrop/>` then `<Ascii>{layers}</Ascii>`; without a backdrop the fallback shows between glyphs). The shaders `Ascii` cellSize is relative to a 1080 px tall canvas, so a ResizeObserver converts CSS px: `cellSize * 1080 / height`. `Ascii` picks glyphs by luminance (`characters` brightest first), and dark scenes come out as all "." at gamma 1, so the default gamma is 0.5 (plasma 0.25).

`*-background/<Name>.tsx`: `splitStage(props)` sends the `STAGE_KEYS` to AsciiOverlay and every other prop to the layer, merged over `<NAME>_DEFAULTS`. The CSS fallback is built from the merged colours. MeshGradient colours come from `stops` (its default 5-stop ramp); `colorA`/`colorB` only apply with `stops={null}`, which MeshBackground handles (`colors` gives evenly spaced stops). ChromaFlow is empty until the pointer moves, so it's screened (`baseColor` black) over a dark two-colour MeshGradient. The browser extension's hover doesn't reach ChromaFlow; test it with `window.dispatchEvent(new MouseEvent("mousemove", ...))`.

## Add a component

1. Make `src/components/<name>/` with `<Name>.tsx` starting with `"use client"` and `index.ts`. Copy `nebula-sky/` (shader scene + clip), `plasma-background/` (gradient) or `dark-veil/` (React Bits). Imports use `.js` extensions (NodeNext). The `ascii/<name>` entry needs no change.
2. A shader scene needs a JOB in `scripts/bake.mjs` and a bake.
3. Tests in `test/ui.test.mjs`; a page in `examples/next-demo/app/`.

## Testing

```bash
npm run build -w packages/react && npm run build -w packages/ui
npm test -w packages/ui                         # against dist/
cd examples/next-demo && npx next build         # /shaders, /gradients and /reactbits build
```

## Gotchas

- `dist/` is built, not committed; the demo resolves the package through the workspace symlink.

## React Bits components

`components/<name>/` per component (`dark-veil/`: `DarkVeil.tsx` plus `glsl.ts` for the shaders), exported only from `ascii/<name>`. Port the JS + CSS variant to TypeScript, keep the behaviour and props the same, inline the CSS as style constants (tsc doesn't copy `.css`, and the package ships none), keep the original class names so users can still style them, and credit React Bits (MIT + Commons Clause) in the header. Add an SSR test and a section on `examples/next-demo/app/reactbits/page.tsx`. GhostFibers, Threads and PixelSnow port as is, except GhostFibers' opt-in `ascii` pass (`ascii.ts`: the glyph atlas at the cell's device-pixel size, up to 4 vector `marks` (SVG paths, each on a `chance` share of lit cells, via `glyphMarkTable`), and `ASCII_FRAGMENT`, which reads the composite from an offscreen target; `glsl.ts` stays upstream's) (PixelSnow keeps its sprite sheets in `sprites.ts`) (its `allocate` already remakes textures). DarkVeil fix vs upstream: `texStorage2D` is immutable, so a resize makes a new texture.
