---
name: ama-ui
description: ascii (packages/ui) - fun, drop-in React/Next.js components built on ascii-magic-art-react, such as LuminoDonut (the Lumino brandmark spinning like donut.c), LuminoSpace (a space background with brandmark stars) and EdgeOrbit (the night Earth from orbit with requests arcing between cities). Use to "add LuminoDonut to a page", "add a space/starfield background", "add a fun component to the UI package", "turn a logo into a spinning 3D piece", or regenerate a logo mask.
---

# ama-ui: fun drop-in components

## What it is

A home for one-off, ready-made components: each is a piece written with `definePiece` plus a `"use client"` wrapper around `AsciiPlayer` (sized art) or `AsciiHero` (a background that fills its container).
Lives in `packages/ui`. package `ascii` (private, local to this repo: `ascii` on npm is an unrelated package, so never publish it), depends on `ascii-magic-art-react`; peers `react`, `react-dom`. Built with `tsc` to `dist/`.

## Exports

| entry | exports |
|---|---|
| `ascii` | `LuminoDonut`, `LuminoSpace`, their props types, and everything in `/pieces` |
| `ascii/<name>` | one component folder, e.g. `ascii/lumino-donut` |
| `ascii/pieces` | `luminoDonut`, `LUMINO_DONUT_PERIOD` (2π / 1.1 ≈ 5.71 s); `luminoSpace`, `LUMINO_SPACE_PERIOD` (120 s); `edgeOrbit`, `EDGE_ORBIT_PERIOD` (1440 s) |

`LuminoDonut` takes every `AsciiPlayer` prop except `piece` and defaults to `size={10}` and a label. `LuminoSpace` and `EdgeOrbit` take every `AsciiHero` prop except `piece` (need a height; `children` sit on top) and default `bg` to `#05060f` / `#04060c`.

## Files

One folder per component in `src/components/<name>/`: `index.ts` (its entry), `<Name>.tsx` (`"use client"` wrapper), `piece.ts`, and assets. `src/index.ts` and `src/pieces.ts` re-export every folder.

- `components/lumino-donut/piece.ts`: the piece. The mask is extruded (`DEPTH`), sampled into surface points with normals, turned with one 3x3 matrix a frame, z-buffered with `Grid.setZ`, shaded with `RAMPS.soft`. Palette keys 0-7 are the glass faces, 8-31 the rainbow edges.
- `components/lumino-donut/mask.ts`: the 96 x 96 brandmark mask. `scripts/mask.mjs` makes masks from SVG/PNG (needs `sharp`).
- `components/lumino-donut/LuminoDonut.tsx`: the client wrapper.
- `components/edge-orbit/piece.ts`: ascii.rest's "edge orbit" (ascii/src/pieces/edge-orbit.ts, by bas3line, MIT) ported to `definePiece`: the meta and the last step (palette indexes to `KEYS`) differ, and a white Lumino brandmark hangs in the top-right sky like a star (`MARK_X/Y/W`; tilted by `MARK_YAW/PITCH/ROLL` through a perspective camera at `MARK_FOCAL`, rocking every 40/60 s). The donut's mask is thinned a pixel so the gaps between its parallel lines stay open, sampled 4 x 4 a cell onto the tilted plane, and its coverage sets the dot directly (not dithered) so lines stay crisp; a halo kept 3+ cells off the lines and rays from its three tips. Twinkles every 6 s, rays every 8 s. ~2.6 ms a frame. Palette keys 0-26 are the original's (the scene picks only from these), 27-30 the brandmark's whites. Without the brandmark, frames match the original exactly. 200 x 100 square cells, 15 fps, ~2 ms a frame, ~70 ms to build its maps. Square cells are never prerendered (`firstFrameHTML` returns null), so the server sends an empty box in `bg`.
- `components/lumino-space/piece.ts`: 160 x 56. A fixed fbm nebula (3 shades), dust in 3 depths, 22 brandmark stars in 3 sizes (12 x 5-7 cols, 7 x 9-13, 3 x 17-23) shaded with `RAMPS.soft` from a summed-area table of the donut's mask. Spin = width scaled by cos; 17+ cols get rainbow edges, 9+ a flare cross when facing, a shooting brandmark every 20 s. Palette keys 0-2 nebula, 3-6 dust, 7-14 glass, 15-38 rainbow. ~0.4 ms a frame.

## Add a component

1. Copy `src/components/lumino-donut/` to `src/components/<name>/`: `piece.ts` (`definePiece` from `ascii-magic-art-react/kit`), `<Name>.tsx` starting with `"use client"`, `index.ts`. Imports use `.js` extensions (NodeNext).
2. Export the folder from `src/index.ts` and its piece from `src/pieces.ts`; the `ascii/<name>` entry needs no change.
3. Tests in `test/ui.test.mjs`; a page in `examples/next-demo/app/`. To port an ascii.rest piece, copy its source and turn `frame(t, env)` (text + `env.color` indexes) into `{ text, color }` with `KEYS[index]`, as edge-orbit does.

## Testing

```bash
npm run build -w packages/react && npm run build -w packages/ui
npm test -w packages/ui                         # against dist/
cd examples/next-demo && npx next build         # /lumino, /space and /orbit build
```

## Gotchas

- Keep `draw(t)` pure in `t` and cheap: it runs 30 times a second in the browser. LuminoDonut is ~1.7 ms a frame; avoid allocating per point.
- Keep the art inside the grid for the whole loop (a test checks LuminoDonut's edges); more tilt or depth needs a smaller `scale`.
- Loops should be seamless: make every motion a whole multiple of one period (drift speeds in whole laps per loop).
- The first frame is prerendered only when its HTML is <= 48 KB (`MAX_PRERENDER` in packages/react). Big grids with many colour changes go over and render empty on the server; a test checks every LuminoSpace frame.
- `dist/` is built, not committed; the demo resolves the package through the workspace symlink.
