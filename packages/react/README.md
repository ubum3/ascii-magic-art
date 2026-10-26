# ascii-magic-art-react

Typed React and Next.js components for the 634 animated pieces in `ascii-magic-art`, plus everything you need to write your own.

- **`<AsciiArt>`** plays any piece by name. The names are typed, so your editor completes them. The first frame is in the server HTML.
- **`<AsciiHero>`** scales a piece to fill its container, behind your content.
- **Ready-made states:** `<AsciiNotFound>`, `<AsciiServerError>`, `<AsciiMaintenance>`, `<AsciiLoader>`, and `<AsciiEmptyState>` with 22 variants.
- **Hooks and a typed kit** for writing pieces in TypeScript: `definePiece`, `useAsciiFrame`, `useAsciiPlayer`, `usePiece`.

Each piece is loaded as its own small chunk, so a page only downloads the pieces it shows. Playback pauses while the art is off screen, and visitors who prefer reduced motion get a still frame.

## Install (local, from this fork)

**Option 1: tarballs (most reliable).** These are real copies, with no symlinks:

```bash
# in the fork
npm pack                                   # -> ascii-magic-art-1.0.2.tgz
cd packages/react && npm pack              # builds, then -> ascii-magic-art-react-0.1.0.tgz

# in your Next app
npm i /path/to/fork/ascii-magic-art-1.0.2.tgz /path/to/fork/packages/react/ascii-magic-art-react-0.1.0.tgz
```

Pack and install again whenever you change the fork.

**Option 2: `npm link`, for working on the library and an app side by side.** Run `npm run dev` in `packages/react`, which rebuilds on save. Then link both packages into your app.

If your app is outside the fork, Turbopack refuses to read files outside its root. Point the root at a folder that contains both:

```ts
// next.config.ts
import path from "node:path";
export default { turbopack: { root: path.resolve(process.cwd(), "..") } };
```

React 18.3+ and React 19 both work. The library doesn't depend on Next at all, so it works in any React app.

## Use it in Next.js (App Router)

```tsx
// app/page.tsx: a Server Component
import { AsciiArt, AsciiHero } from "ascii-magic-art-react/server";

export default function Home() {
  return (
    <>
      <AsciiHero piece="synthwave-grid" dim={0.4} style={{ height: "70vh" }}>
        <h1>My site</h1>
      </AsciiHero>
      <AsciiArt piece="spinning-torus" look="dots" size={10} />
    </>
  );
}
```

```tsx
// app/not-found.tsx
import { AsciiNotFound } from "ascii-magic-art-react";
export default function NotFound() {
  return <AsciiNotFound as="h1" title="Lost in space" action={<a href="/">Home</a>} />;
}
```

```tsx
// app/loading.tsx
import { AsciiLoader } from "ascii-magic-art-react";
export default function Loading() { return <AsciiLoader variant="torus" />; }
```

```tsx
// app/error.tsx (Next requires this to be a client component)
"use client";
import { AsciiServerError } from "ascii-magic-art-react";
export default function Error({ reset }: { reset: () => void }) {
  return <AsciiServerError title="Something went wrong" action={<button onClick={reset}>Try again</button>} />;
}
```

### Server or client: which import?

| You are in | Use | Why |
|---|---|---|
| A Server Component, piece picked by name | `AsciiArt` / `AsciiHero` from **`ascii-magic-art-react/server`** | Loads the piece on the server and puts its first frame in the HTML. |
| A Server Component, library module (`import * as torus from "ascii-magic-art/pieces/spinning-torus.js"`) | the same `/server` components | They send the piece's name to the client, since modules can't be sent. |
| A client component (`"use client"`) | anything from `ascii-magic-art-react` | `AsciiArt` by name shows an empty box of the right size until the piece loads. `AsciiPlayer` with a module puts the frame in the HTML too. |
| Your own piece (`definePiece`) | `AsciiPlayer` inside a `"use client"` file | A module holds functions, and React can't send those from server to client. |

The state components (`AsciiNotFound`, `AsciiLoader` and the rest) work in both. Their pieces are bundled with them, so the first frame is always in the HTML. The exceptions are the empty-state pieces, which each load on demand.

## Components

### `<AsciiArt>` and `<AsciiPlayer>`

`AsciiArt` takes `piece: PieceSlug | PieceModule`. `AsciiPlayer` takes only a module and never loads the list of all 634 pieces, which is the smallest option.

| prop | default | what it does |
|---|---|---|
| `size` | `12` | font size: a number of px, or any CSS length |
| `speed` | `1` | playback speed |
| `still` | | show one frame, no animation |
| `paused` | | freeze the current frame; playback resumes from it |
| `bg` | | background colour behind the art |
| `look` | | `dots`, `ascii`, `dense`, `numbers`, `binary`, `letters`, `blocks`, `squares`, `lines`, `dither` |
| `chars` | | your own characters instead of a look, e.g. `" .oO@"` |
| `mono` | | one colour (the CSS `color`) instead of the palette |
| `all` | | with `look`/`chars`, redraw text and line work too |
| `contrast` | `0` | 0 to 100 |
| `dotSize` | `51` | halftone dot size, 25 to 120 |
| `density` | `131` | halftone dot spacing, 40 to 250 |
| `steps` | `3` | halftone dot sizes: 3, 5, or 0 for smooth |
| `t0` | `0` | start this many seconds into the piece |
| `maxFps` | | cap the frame rate |
| `dom` | | rewrite the `<pre>` instead of drawing a canvas (selectable text, slower) |
| `ssr` | `true` | `false` sends an empty box instead of the first frame |
| `onFrame`, `onReady`, `onError` | | callbacks (client only) |
| `label`, `className`, `style` | | the wrapper is `role="img"` with an `aria-label` |

### `<AsciiHero>`

The piece is scaled with CSS container units, so it's already the right size in the server HTML. After a resize it redraws sharp.

- `fit`: `"cover"` (default) fills edge to edge. `"contain"` shows the whole piece.
- `dim` (0 to 1) darkens the art under your text. `opacity` fades it.
- **Give it a height** with `className` or `style`. It defaults to `min-height: 24rem`.

The art is hidden from screen readers unless you pass a `label`.

### States

Every state takes `title`, `description`, `action`, `children`, `size`, `as` (the heading tag), the look props, `className` and `style`.

- `AsciiNotFound` (page-404), `AsciiServerError` (page-500), `AsciiMaintenance`
- `AsciiLoader variant="progress" | "spinners" | "skeleton" | "torus" | "cassette"`, wrapped in `role="status"`
- `AsciiEmptyState variant=…`, one of: `access-denied`, `all-caught-up`, `broken-link`, `coming-soon`, `confetti`, `copied`, `cobweb`, `inbox`, `no-results`, `offline`, `onboarding`, `payment-failed`, `payment-success`, `rate-limited`, `reconnecting`, `saved`, `server-error`, `session-expired`, `trash`, `under-construction`, `upload`, `welcome`

`EMPTY_VARIANTS` and `LOADER_VARIANTS` list them, for building pickers.

## Your own pieces

```ts
// app/build-badge.ts
import { Grid, palette, definePiece } from "ascii-magic-art-react/kit";

export default definePiece(
  { slug: "build-badge", cols: 40, rows: 5, fps: 12, palette: palette(["#7ee787", "#8b949e"]) },
  () => {
    const g = new Grid(40, 5);                       // made once per player
    return (t) => {                                  // t: seconds -> one frame, exactly cols x rows
      g.clear();
      g.box(0, 0, 40, 5, "round", "1");
      g.text(3, 2, `build #${Math.floor(t)}`, "0");  // "0" = the first palette colour
      return g.frame();
    };
  },
);
```

```tsx
// app/Badge.tsx
"use client";
import { AsciiPlayer } from "ascii-magic-art-react";
import badge from "./build-badge";
export default function Badge() { return <AsciiPlayer piece={badge} size={14} />; }
```

Rules that keep it smooth:

- Define pieces at module level, never inside a component. A new module object on every render would restart playback.
- Keep `draw(t)` a pure function of `t`, so the server and the browser draw the same first frame.

`ascii-magic-art-react/kit` re-exports the whole typed kit (`Grid`, `rng`, `noise2`, `fbm`, `hsl`, `palette`, `gradient`, `rotX`/`rotY`/`rotZ`, `project`, `wire`, `bigText`, `RAMPS`) plus `restyle`, `withLook` and `frameHTML`. The 634 pieces in `ascii-magic-art/pieces/` are the best examples.

## Extras: logos, text, data, clips, the webcam

`ascii-magic-art-react/extras` plays pieces made from data ([packages/extras](../extras/README.md)), through `AsciiPlayer`, so every look and prop works:

```tsx
"use client";
import { AsciiSpec, AsciiClip, AsciiSequence, AsciiWebcam, type BrandSpec } from "ascii-magic-art-react/extras";
import logo from "./logo.json"; // npx ama-studio brand logo.svg --effect assemble -o logo.json

<AsciiSpec spec={logo as BrandSpec} />
<AsciiSpec spec={{ kind: "progress", cols: 40 }} state={{ value: progress, label: "Uploading" }} />
<AsciiSpec spec={{ kind: "celebrate", message: "Payment approved", style: "confetti" }} />
<AsciiClip src="/intro.amc" />                       {/* npx ama-studio convert intro.mp4 -o public/intro.amc */}
<AsciiSequence pieces={[logo as BrandSpec, { kind: "text", text: "WELCOME" }]} kind="melt" />
<AsciiWebcam cols={80} />                            {/* asks for the camera; nothing leaves the page */}
```

- **`state`:** data kinds read it every frame, so changing it never restarts playback. Changing the `spec` does restart it.
- **Server rendering:** `AsciiSpec` and `AsciiSequence` render their first frame on the server, like `AsciiPlayer`. Clips and the webcam start on the client.
- **Hooks:** `useSpecPiece(spec, state)` and `useClip(src)` give you the piece module. `loadClip(bytes)` decodes a clip with the browser's `DecompressionStream`.
- **`usePixelsPiece(source, { square, colors, bg })`:** anything you can draw into a 2D canvas, as a live piece. `source` is `{ cols, rows, draw(ctx, w, h) }`, and `draw` is called every frame. `AsciiWebcam` and `AsciiShader` are built on it.

## Shaders: WebGPU, as ASCII

`ascii-magic-art-react/shader` plays a WebGPU shader as ASCII art. You bring the shader: a `<Shader>` tree from the [`shaders`](https://shaders.com) package, or any element that renders a `<canvas>`. This package doesn't depend on it.

```tsx
"use client";
import { Shader, Aurora, FilmGrain } from "shaders/react";
import { AsciiShader } from "ascii-magic-art-react/shader";
import { AsciiArt } from "ascii-magic-art-react";

<AsciiShader cols={96} colors={24} fallback={<AsciiArt piece="aurora-curtains" />}>
  <Shader><Aurora /><FilmGrain /></Shader>
</AsciiShader>
```

- **How it works:** the shader draws into a hidden canvas laid over the art, and every frame that canvas is read back into cells.
- **Fallback:** `fallback` shows on the server, while the GPU starts, and wherever WebGPU is unavailable. `onUnavailable(reason)` is called once. A good fallback is a baked clip of the same shader: `npx ama-studio bake "Aurora,FilmGrain" -o public/aurora.amc`, then `<AsciiClip src="/aurora.amc" />`.
- **Telemetry:** `<Shader>` reports usage to shaders.com by default. `AsciiShader` turns that off, and asks for sRGB, which is what a 2D canvas reads. Pass `telemetry` to leave both as they are.
- **Other props:** `rows` (default 16:9), `square` (default true), `colors` (default 32), `bg` for a shader with transparency, and `interactive` to give the hidden shader the pointer. Every `AsciiPlayer` prop works too.

## ascii.rest pieces

`ascii-magic-art-react/rest` plays the 240 pieces of [ascii.rest](../rest-bridge/README.md) (tech logos, companies, Linux distros and scenes) through the same player, so every look and prop works:

```tsx
// app/page.tsx: a Server Component, first frame in the HTML
import { AsciiRest } from "ascii-magic-art-react/rest/server";
<AsciiRest piece="rust" look="dots" />
```

```tsx
"use client";
import { AsciiRest, useRestPiece, REST_CATALOG } from "ascii-magic-art-react/rest";
<AsciiRest piece="night-coast" />               {/* loads as its own chunk; a box of its size until then */}
const { module } = useRestPiece("ubuntu");      // for AsciiPlayer, AsciiSequence or your own player
```

`REST_CATALOG` lists each piece's slug, name, categories, note and size, for pickers.

## Hooks

- `useAsciiFrame(piece, { look, playing, speed, fps, t0, ref })` returns `{ frame, text, html, t }` as React state, for putting a piece into your own markup (a status-bar spinner, a terminal UI). It re-renders every frame, so keep it for small pieces.
- `useAsciiPlayer(preRef, source, key, look, options)` is the canvas player behind every component. It returns `{ status, meta, restart, time }`.
- `usePiece(slugOrModule)` returns `{ module, size, status }`.
- `useReducedMotion()`.

## Other entry points

- `ascii-magic-art-react/catalog`: `CATALOG` (name, category, note, tags, size and fps of every piece) and `CATEGORIES`, for gallery or picker pages. It's about 200 KB, so import it only on those pages.
- `firstFrameHTML(module, look?, t0?)`, `loadPiece(slug)`, `sizeOf(piece)` and `isSlug(s)`, exported from both entries.

## Notes

- **Two copies of the first frame.** With the `/server` components, the first frame is in the HTML and again in the React Server Components payload. The art compresses well (the demo's gallery is 16 KB gzipped), but for a page with many large pieces, `ssr={false}` sends a box instead.
- **Box instead of a frame.** Photo-style pieces (`cell: "square"`, such as `ocean-sunset`) and frames over 48 KB of HTML send an empty box of the exact size.
- **Changing a piece's look or size restarts it** from the same moment, not from zero.

## Developing

```bash
npm run build       # regenerate the registry from ../../pieces, then tsc -> dist
npm test            # smoke tests against dist (server rendering, registry, "use client")
npm run dev         # tsc --watch
npm run gen         # just the registry, after adding or renaming a piece
```

There's a demo app in `examples/next-demo`: `npm -w next-demo run dev`.
