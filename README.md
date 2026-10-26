<p align="center">
  <img src="assets/banner.svg" alt="ascii magic art" width="100%">
</p>

<p align="center">
  634 animated ASCII art pieces for web pages, READMEs, wallpapers and terminals.<br>
  Scenes, interfaces, charts, diagrams, 3D shapes, loaders, games, dividers and more, in 24 categories.<br>
  <a href="https://www.ascii-magic.com/ascii">Browse the library</a> ·
  <a href="https://www.ascii-magic.com/ascii/docs">Docs</a> ·
  <a href="https://www.ascii-magic.com/ascii/banner">Make a README banner</a> ·
  <a href="https://www.ascii-magic.com/ascii/use">Use cases</a>
</p>

## Add one to your project in one prompt

```bash
npx ascii-magic-art
```

Browse all 634 pieces live in your terminal. Arrow keys move between pieces and categories, `s` changes the look (halftone dots, ASCII, binary, dither and more) and `a` redraws text and line art too. Press enter and a prompt for that piece, in that look, is copied to your clipboard: paste it into Claude Code, Cursor, Copilot or any coding agent and it adds the piece to your site. Or skip the browsing:

```bash
npx ascii-magic-art prompt matrix-rain
```

## Play one in your terminal

```bash
npx ascii-magic-art moonlit-sea
npx ascii-magic-art --list
npx ascii-magic-art matrix-rain --seconds=3    # stop on its own, for shell startup
npx ascii-magic-art sleeping-cat --frame       # print one still frame, for a MOTD
```

Any key stops it. Add `--look=dots` (or `ascii`, `numbers`, `binary`...) or `--chars=" .oO@"` to redraw it in other characters. Colour turns off when output is piped or `NO_COLOR` is set.

## Put one on a web page

```html
<script type="module" src="https://www.ascii-magic.com/ascii/ascii.js"></script>

<ascii-art piece="moonlit-sea"></ascii-art>
```

Attributes:

| attribute | what it does |
|-----------|--------------|
| `piece`   | the piece name, as in the URL of its page |
| `size`    | font size in px (default 12) |
| `speed`   | playback speed, 1 is normal |
| `still`   | show one frame, no animation |
| `bg`      | background colour behind the art |
| `look`    | redraw it in another character set: `dots`, `ascii`, `dense`, `numbers`, `binary`, `letters`, `blocks`, `squares`, `lines`, `dither` |
| `chars`   | your own characters instead of a look, e.g. `chars=" .oO@"` (sorted light to dark for you) |
| `mono`    | one colour instead of the piece's palette |
| `all`     | with `look` or `chars`, redraw text and line work too, not only shading |
| `contrast`| 0 to 100, default 0 |
| `dot-size`| halftone dot size for the `dots` look, 25 to 120, default 51 |
| `density` | halftone dot spacing, 40 to 250, default 131 (more dots, same size) |
| `steps`   | halftone dot sizes: `3`, `5`, or `0` for smooth |

The element plays only while it is on screen, and holds a still frame for visitors who prefer reduced motion.

## React and Next.js

`packages/react` is a typed component library on top of the pieces. It includes:

- `<AsciiArt piece="…">` with the first frame rendered on the server
- a full-bleed `<AsciiHero>`
- ready-made 404, error, loading and empty states
- `definePiece` and hooks for writing your own pieces in TypeScript

See [packages/react/README.md](packages/react/README.md), and `examples/next-demo` for a working app.

[packages/ui](packages/ui/README.md) (`ascii`) holds fun, drop-in components built on it, such as `<LuminoDonut>`, the `<LuminoSpace>` and `<EdgeOrbit>` backgrounds, WebGPU shader scenes played as ASCII (`<NebulaSky>`, `<CursorField>`, `<LuminoHolo>`, `<AsciiTransition>`), and customisable gradient backgrounds with an optional ASCII overlay (`<PlasmaBackground>`, `<SilkBackground>`, `<MeshBackground>`, `<ChromaBackground>`).

## Terminal UIs: ratatui and Bubble Tea

Every piece also plays in terminal apps, as a full-screen background or as an intro with a title card that fades in and out. Each package also lets you write your own pieces in that language.

- **Rust:** [packages/ratatui](packages/ratatui/README.md) has the `AsciiArt` widget, `Intro` and `intro::run`. Pieces run in embedded QuickJS.
- **Go:** [packages/bubbletea](packages/bubbletea/README.md) has an `asciiart.Model` component for Bubble Tea v2, `Background`, and an `intro` package. Pieces run in goja, which is pure Go.

Both packages run the pieces from this repo. After adding or changing pieces, rebuild them with `npm run native`.

## Extras: your logo, photos, videos, text and data

- **[packages/studio](packages/studio/README.md)** is `ama-studio`, the easy way in. `ama-studio brand logo.svg --effect assemble -o logo.json` makes your logo into an animated intro. `ama-studio convert photo.jpg` and `ama-studio convert clip.mp4 -o clip.amc` turn pictures and videos into ASCII. `ama-studio export <anything> -o out.gif` writes an asciinema `.cast`, a GIF, an MP4, a WebM or a PNG.
- **[packages/extras](packages/extras/README.md)** has pieces made from JSON specs: logos with entrance effects, animated text, progress bars, sparklines, tickers, celebrations, pictures, `.amc` clips and transitions.

  The same spec plays in React (`ascii-magic-art-react/extras`), Rust (`Player::from_spec`) and Go (`asciiart.FromSpec`). The Rust and Go packages also add native clips, transitions between screens, intros that go straight into your app, and cast recording. Each package has a `brand` example: a logo intro that dissolves into a live dashboard.

- **[packages/rest-bridge](packages/rest-bridge/README.md)** brings in [ascii.rest](https://github.com/bas3line/ascii) (MIT) both ways:
  - its 240 pieces (tech logos, companies, Linux distros and scenes) play everywhere as `rest-<name>`
  - its animated SVGs (`ama-studio export logo.json -o logo.svg --both`), banner fonts (`ama-studio banner`) and shape-matched logo glyphs (`ama-studio brand logo.svg --style glyphs`) work on ours

The ascii.rest and shaders sources are included at `./ascii` and `./shaders`, copied from the [ubum3/ascii](https://github.com/ubum3/ascii) and [ubum3/shaders](https://github.com/ubum3/shaders) forks.

None of this changes the pieces, `lib/` or `runtime/`. It builds on them.

## Use a piece in your own code

```bash
npm install ascii-magic-art
```

Every piece is one small ES module with no dependencies apart from `lib/kit.js`. It exports `meta` and a `create()` function that returns `draw(t)`, a function from seconds to a frame:

```js
import create, { meta } from "ascii-magic-art/pieces/spinning-torus.js";

const draw = create();
const frame = draw(1.5);            // a string, or { text, color }
console.log(frame.text ?? frame);
```

A frame with colour has a `color` layer the same shape as `text`. Each character in it is a key into `meta.palette` (a space means the default ink). `runtime/player.js` turns that into HTML; `runtime/canvas.js` draws it to a canvas for PNG, GIF and video export.

## Looks

Every piece can be redrawn in a different set of characters. Each cell's darkness comes from how much ink its glyph covers and how bright its colour is; the look's characters are sorted by ink and the nearest one is drawn. Shading blocks are redrawn, text and line work stay as they are (pass `all: true` to redraw everything).

```js
import { restyle, withLook } from "ascii-magic-art/runtime/glyphs.js";

const frame = restyle(draw(1.5), meta.palette, { look: "dots" });
const drawInNumbers = withLook(create(), meta.palette, { look: "numbers" });
```

## Make a piece

```js
import { Grid } from "../lib/kit.js";

export const meta = {
  slug: "my-piece", name: "My Piece", category: "generative",
  note: "One line about it.", tags: ["loop", "minimal"],
  cols: 60, rows: 20, fps: 24,
};

export default function create() {
  const g = new Grid(meta.cols, meta.rows);
  return (t) => {
    g.clear();
    g.text(2, 2, "hello " + Math.floor(t));
    return g.frame();
  };
}
```

Then check it:

```bash
node scripts/validate.mjs my-piece
```

The validator checks the size of every frame, the character set, that it animates, and that each frame draws in under 12 ms.

## Licence

MIT. Use the pieces anywhere, including commercial work. A link back is appreciated, not required. Two photo-based scenes, `ocean-sunset` and `starry-ridge`, keep the Unsplash License of their source photos; see [NOTICE](NOTICE).

Want your own photo, logo or video as animated ASCII? That is what [ASCII Magic](https://www.ascii-magic.com) does.
