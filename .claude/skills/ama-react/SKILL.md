---
name: ama-react
description: React/Next.js components for ascii-magic-art (packages/react, ascii-magic-art-react). Use to "add an ASCII animation to a React page", use the AsciiArt/AsciiHero/AsciiPlayer components, render an SSR first frame, add a 404/loader/empty state, play a spec or ascii.rest piece in React, or write a piece with definePiece.
---

# ama-react: ascii-magic-art for React and Next.js

## What it is

Typed React 18.3+/19 components that play the 634 pieces of `ascii-magic-art`, with the first frame rendered on the server. It also ships ready-made states (404, 500, loaders, 22 empty states), hooks, a typed kit for writing pieces, and sub-entries for extras specs, ascii.rest pieces, WebGPU shaders and a "time lens".
Lives in `packages/react`. The npm package is `ascii-magic-art-react` (peer deps: `ascii-magic-art >=1.0.2`, `react`, `react-dom`). It does not depend on Next.

## Quick start

```bash
# local install from the fork (tarballs are the most reliable)
npm pack                                 # repo root -> ascii-magic-art-1.0.2.tgz
cd packages/react && npm pack            # builds first -> ascii-magic-art-react-0.1.0.tgz
```

```tsx
// app/page.tsx (Server Component): the first frame is in the HTML
import { AsciiArt, AsciiHero } from "ascii-magic-art-react/server";

export default function Home() {
  return (
    <>
      <AsciiHero piece="synthwave-grid" dim={0.4} style={{ height: "70vh" }}><h1>My site</h1></AsciiHero>
      <AsciiArt piece="spinning-torus" look="dots" size={10} />
    </>
  );
}
```

## Core API

Entry points (from `package.json` `exports`):

| import | what |
|---|---|
| `ascii-magic-art-react` | client: `AsciiArt`, `AsciiPlayer`, `AsciiHero`, states, hooks, `firstFrameHTML`, `boxSize`, `loadPiece`, `resolvePiece`, `sizeOf`, `isSlug`, `toLook` |
| `ascii-magic-art-react/server` | async `AsciiArt`, `AsciiHero` for Server Components (prerender the first frame) |
| `ascii-magic-art-react/kit` | `definePiece`, the kit (`Grid`, `palette`, `rng`, `noise2`, `fbm`, `hsl`, `gradient`, `rotX/Y/Z`, `project`, `wire`, `bigText`, `RAMPS`), `restyle`, `withLook`, `LOOKS`, `frameHTML`, `frameText` |
| `ascii-magic-art-react/catalog` | `CATALOG`, `CATEGORIES` (about 200 KB, picker pages only) |
| `ascii-magic-art-react/extras` | `AsciiSpec`, `AsciiClip`, `AsciiSequence`, `AsciiWebcam`, `useSpecPiece`, `useClip`, `loadClip`, `usePixelsPiece`, `fromSpec`, `sequence` |
| `ascii-magic-art-react/rest` / `rest/server` | `AsciiRest`, `useRestPiece`, `loadRestPiece`, `REST_CATALOG`, `restSlugs`, `restSize`, `isRestSlug` |
| `ascii-magic-art-react/shader` | `AsciiShader` (WebGPU canvas read back into cells) |
| `ascii-magic-art-react/lens` | `AsciiTimeLens`, `timeLens`, `createLens`, `lensFrame` |

- `AsciiArt` takes `piece: PieceSlug | PieceModule`; `AsciiPlayer` takes a module only (smallest bundle).
- Shared props: `size` (12), `speed` (1), `still`, `paused`, `bg`, `t0`, `maxFps`, `dom`, `ssr` (true), `onFrame`, `onReady`, `onError`, `label`, `className`, `style`.
- Look props (`LookProps`): `look` (`dots|ascii|dense|numbers|binary|letters|blocks|squares|lines|dither`), `chars`, `mono`, `all`, `contrast` 0–100, `dotSize` 25–120, `density` 40–250, `steps` 3|5|0.
- `AsciiHero`: `fit` `"cover"|"contain"`, `dim` 0–1, `opacity`, `children`; defaults to `min-height: 24rem`.
- States: `AsciiNotFound`, `AsciiServerError`, `AsciiMaintenance`, `AsciiLoader variant="progress"|"spinners"|"skeleton"|"torus"|"cassette"`, `AsciiEmptyState variant=...` (list in `EMPTY_VARIANTS`, `LOADER_VARIANTS`). Props: `title`, `description`, `action`, `children`, `size`, `as` (`h1|h2|h3|p`), look props.
- Hooks: `useAsciiFrame(piece: PieceModule, { look, playing, speed, fps, t0, ref })` -> `{ frame, text, html, t }`; `useAsciiPlayer(preRef, source, sourceKey, look, opts)` -> `{ status, meta, error, restart, time }`; `usePiece(slugOrModule)` -> `{ module, size, status }`; `useReducedMotion()`.
- `definePiece(meta: { slug, cols, rows, ...}, create: () => DrawFn): PieceModule`.

## Common tasks

```tsx
// 1. ascii.rest piece, first frame on the server ("rust" or "rest-rust")
import { AsciiRest } from "ascii-magic-art-react/rest/server";
<AsciiRest piece="rust" look="dots" />
```

```tsx
// 2. A spec from packages/extras, with live state (state changes never restart playback)
"use client";
import { AsciiSpec, type BrandSpec } from "ascii-magic-art-react/extras";
import logo from "./logo.json"; // npx ama-studio brand logo.svg --effect assemble -o logo.json
<AsciiSpec spec={logo as BrandSpec} />
<AsciiSpec spec={{ kind: "progress", cols: 40 }} state={{ value: progress, label: "Uploading" }} />
<AsciiSpec spec={{ kind: "celebrate", message: "Payment approved", style: "confetti" }} />
```

```tsx
// 3. Clips and sequences (clips start on the client only)
<AsciiClip src="/intro.amc" />   {/* npx ama-studio convert intro.mp4 -o public/intro.amc */}
<AsciiSequence pieces={[logo as BrandSpec, { kind: "text", text: "WELCOME" }]} kind="melt" />
```

```tsx
// 4. Next.js special files
// app/not-found.tsx
import { AsciiNotFound } from "ascii-magic-art-react";
export default function NotFound() { return <AsciiNotFound as="h1" title="Lost in space" action={<a href="/">Home</a>} />; }
// app/loading.tsx
import { AsciiLoader } from "ascii-magic-art-react";
export default function Loading() { return <AsciiLoader variant="torus" />; }
```

```ts
// 5. Your own piece: define at module level, play from a "use client" file with <AsciiPlayer piece={badge} />
import { Grid, palette, definePiece } from "ascii-magic-art-react/kit";
export default definePiece({ slug: "build-badge", cols: 40, rows: 5, fps: 12, palette: palette(["#7ee787", "#8b949e"]) }, () => {
  const g = new Grid(40, 5);
  return (t) => { g.clear(); g.box(0, 0, 40, 5, "round", "1"); g.text(3, 2, `build #${Math.floor(t)}`, "0"); return g.frame(); };
});
```

```tsx
// 6. Theming / looks: custom chars, one colour, halftone tuning
<AsciiArt piece="matrix-rain" chars=" .oO@" mono style={{ color: "#7ee787" }} />
<AsciiArt piece="moonlit-sea" look="dots" dotSize={70} density={160} steps={0} contrast={40} />
```

```tsx
// 7. A WebGPU shader with a fallback (server, GPU startup, no WebGPU)
import { AsciiShader } from "ascii-magic-art-react/shader";
<AsciiShader cols={96} colors={24} fallback={<AsciiArt piece="aurora-curtains" />}><Shader><Aurora /></Shader></AsciiShader>
```

## Testing and verification

```bash
cd packages/react
npm run build        # gen registry from ../../pieces, then tsc -> dist (tests read dist!)
npm test             # node --test test/*.test.mjs: smoke (SSR, registry, "use client") + lens
npm run typecheck
cd ../.. && node scripts/validate.mjs     # must print 634/634 pieces pass
npm -w next-demo run dev                  # optional: the demo app in examples/next-demo
```

`npm test` does not build; stale `dist/` gives false results. If you touched `packages/extras`, also run `npm test -w packages/extras` and `npm run native`.

## Rules and gotchas

- Additive only: never edit `pieces/`, `lib/`, `runtime/` or `bin/`. New behaviour goes in `packages/react/src`.
- After changing the JS engine or `packages/extras`, run `npm run native` (repo root) to regenerate `pieces.bin` and the goldens in `packages/fixtures/`. Existing goldens (`golden.bin`, `extras-golden.bin`, `rest-golden.bin`) must stay byte-identical.
- `src/registry/*.generated.ts` are generated by `npm run gen` / `npm run build`. Never hand-edit them; rerun after adding or renaming a piece.
- Server vs client: in a Server Component use `/server` (or `/rest/server`). Custom `definePiece` modules hold functions and cannot cross to the client: render them with `AsciiPlayer` in a `"use client"` file. The `/server` components throw for a non-library module.
- Define pieces at module level, never inside a component (a new module object restarts playback). Keep `draw(t)` pure in `t` so server and client draw the same first frame.
- Client `AsciiArt` by slug sends an empty sized box until the chunk loads; only `/server` and `AsciiPlayer` with a module put the frame in the HTML.
- Photo pieces (`cell: "square"`, e.g. `ocean-sunset`) and frames over 48 KB of HTML get an empty box, not a frame. For pages with many large pieces use `ssr={false}` (the frame is sent twice: HTML and RSC payload).
- `PieceSlug` only covers the 634 library pieces: ascii.rest pieces go through `AsciiRest`/`useRestPiece`, not `AsciiArt`.
- Changing `spec` restarts `AsciiSpec`; changing `state` does not. Changing look or size restarts from the same moment.
- `AsciiTimeLens` refuses data specs (`progress`, `sparkline`, `ticker`, `celebrate`, `layout`) and caps at 30 fps.
- `useAsciiFrame` re-renders every frame; keep it for small pieces.
- Turbopack outside the fork: set `turbopack.root` to a folder containing both app and fork.
