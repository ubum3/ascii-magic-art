# asciiart for Bubble Tea

The 634 animated pieces from `ascii-magic-art` as [Bubble Tea v2](https://github.com/charmbracelet/bubbletea) components, for **backgrounds**, **intros** and **splash screens** in terminal apps.

- **`asciiart.Model`** is a component in the style of the bubbles: `Init`, `Update`, `View() string`. It plays any piece at any size, with fit, dim and background options.
- **`asciiart.Background`** composites your view centred over the art, using lipgloss v2 layers.
- **`intro.New`** is a top-level model. It fades a piece in, holds it, and fades it out with a title card, then hands the program over to your model.
- **`Piece` and `Grid`** let you write your own pieces in Go. They play exactly like library pieces.

The library pieces are the real JavaScript ones from this repo. They run in [goja](https://github.com/dop251/goja), a JS engine in pure Go (no cgo). All 634 pieces and all 11 looks are available, and a test checks every piece against the frames Node draws.

## Install (local, from this fork)

```bash
go get github.com/ubum3/ascii-magic-art/packages/bubbletea
# or, before it's pushed, from your module:
go mod edit -replace github.com/ubum3/ascii-magic-art/packages/bubbletea=/path/to/fork/packages/bubbletea
```

The package name is `asciiart`. The pieces add about 2 MB to your binary.

## Quick start

```go
import (
    tea "charm.land/bubbletea/v2"
    asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
    "github.com/ubum3/ascii-magic-art/packages/bubbletea/intro"
    "github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

func main() {
    art := asciiart.MustSlug(slug.MoonlitSea)
    splash := intro.New(art, myApp{}, intro.Title("My App"), intro.Subtitle("v1.0"), intro.Hint("press any key"))
    if _, err := tea.NewProgram(splash).Run(); err != nil { ... }
}
```

After the intro, your model gets its `Init` and then a `tea.WindowSizeMsg`, as if it had started first. During the intro, Ctrl-C, Esc and `q` quit, and any other key skips ahead.

`slug.` has a constant for every piece, and `slug.All` lists them. `asciiart.Catalog()` returns the meta of every piece: name, category, note, tags, size and fps.

## A background

```go
type model struct {
    art  asciiart.Model
    w, h int
}

func newModel() model {
    art, err := asciiart.FromSlug(slug.SynthwaveGrid, asciiart.WithFit(asciiart.FitCover), asciiart.WithDim(0.6))
    if err != nil { panic(err) }   // a bad slug errors with suggestions
    return model{art: art}
}

func (m model) Init() tea.Cmd { return m.art.Init() }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    if s, ok := msg.(tea.WindowSizeMsg); ok {
        m.w, m.h = s.Width, s.Height
        m.art.SetSize(m.w, m.h)
    }
    var cmd tea.Cmd
    m.art, cmd = m.art.Update(msg)   // pass every message on: the frames arrive as messages
    return m, cmd
}

func (m model) View() tea.View {
    panel := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(1, 4).Render("Welcome back")
    v := tea.NewView(asciiart.Background(m.art.View(), panel, m.w, m.h))
    v.AltScreen = true
    return v
}
```

Every cell of the panel, spaces included, covers the art. Use `asciiart.Overlay(base, content, x, y)` to place content somewhere else.

## Model

| option | what it does |
|---|---|
| `WithSize(w, h)` / `SetSize` | the size `View` fills; zero is the piece's own size |
| `WithFit(f)` / `SetFit` | `FitCenter` (default), `FitCover`, `FitContain`, `FitStretch`, `FitTile` |
| `WithAlign(a)` | where the art sits: `AlignCenter`, `AlignTopLeft`, `AlignBottom`, and so on |
| `WithDim(d)` / `SetDim` | 0 is full strength, 1 is gone (blends toward the background) |
| `WithBackground(rgb)` | paint the whole area |
| `WithMono(rgb)` | one colour |
| `WithLook(l)` / `SetLook` | `asciiart.LookOf(asciiart.Dots)`, `asciiart.Look{Chars: " .oO@"}`, and so on |
| `WithSpeed`, `WithStill`, `WithMaxFPS`, `WithStart` | playback speed, one still frame, a frame-rate cap, a start time |

Controls: `Pause()`, `Resume()`, `TogglePause()`, `Seek(t)`, `SetSpeed(s)`. The ones that return a `tea.Cmd` need that command returned from your `Update`. You can also read `Frame()`, `Meta()`, `Time()`, `Err()` and `Ready()`.

- **Drawing happens in a command, off the UI loop.** Each model draws one frame at a time and schedules the next when it arrives. A slow piece plays at a lower frame rate, and your app stays responsive.
- **Several models can run at once.** Their frames don't mix.
- **Colours** come out as 24-bit escapes. Bubble Tea v2 brings them down to what the terminal supports and drops them for `NO_COLOR`.
- **Photo pieces** (`cell: "square"`, such as `ocean-sunset`) draw two pixels per cell with `▀`.
- `asciiart.Render(&frame, asciiart.Style{...})` turns any frame into a string, if you want frames without a Model.

## Intro options

`intro.Title`, `Subtitle`, `Hint`, `FadeIn`, `Hold`, `FadeOut`, `UntilKey()` (hold until a key), `Skippable`, `Accent`, `Background`, `TitleBox` and `AltScreen`.

The art fills the window (`FitCover`) unless the model already had another fit.

## Your own pieces

```go
type badge struct {
    meta asciiart.Meta
    g    *asciiart.Grid
}

func (b *badge) Meta() asciiart.Meta { return b.meta }

func (b *badge) Draw(t float64) asciiart.Frame {   // t: seconds -> exactly cols x rows
    b.g.Clear()
    b.g.Box(0, 0, 20, 3, asciiart.BoxRound, '1')
    b.g.Text(2, 1, fmt.Sprintf("build #%d", int(t)), '0')   // '0' = first palette colour
    return b.g.Frame(&b.meta.Palette)
}

meta := asciiart.NewMeta("badge", 20, 3)
meta.Palette = asciiart.NewPalette("#7ee787", "#8b949e")
art := asciiart.New(&badge{meta, asciiart.NewGrid(20, 3)})
```

`Grid` has `Set`, `Get`, `Text`, `Block`, `HLine`, `VLine`, `Box`, `Fill`, `Line`, `Circle` and `Shade`, plus `Ramp()` and `Ramps`, as in `lib/kit.js`. `asciiart.NoKey` leaves a cell's colour as it is. Looks only apply to library pieces.

## Extras: logos, text, data, clips, transitions, casts

Pieces made from data ([packages/extras](../extras/README.md)) run in the same engine:

```go
logo, err := asciiart.FromSpec(string(logoJSON))                       // from `ama-studio brand logo.svg -o logo.json`
text, err := asciiart.TextSpec("DEPLOYED").Effect(asciiart.Scramble).Model()
bar, err := asciiart.ProgressSpec(40).With("label", "Uploading").Model()
cmd := bar.SetState(map[string]any{"value": 0.42})                      // return cmd from your Update
party, err := asciiart.CelebrateSpec("Payment approved", asciiart.Check).Model()
clip, err := asciiart.OpenClip("demo.amc")                               // `ama-studio convert demo.mp4 -o demo.amc`
m := asciiart.New(clip)
```

- **Specs:** `FromSpec(json)` and `Spec` (`TextSpec`, `ProgressSpec`, `SparklineSpec`, `TickerSpec`, `CelebrateSpec` and `ParseSpec`). `ImageSpec(img, cols, square)` takes any `image.Image`. `Model.SetState` feeds data kinds without waiting on a draw.
- **Clips:** `LoadClip` and `OpenClip` read `.amc` files natively, without the JS engine. A `*Clip` is a `Piece`.
- **Transitions:** `asciiart.Transition(kind, fromView, toView, w, h, p)` mixes any two rendered views: `Dissolve`, `WipeRight`, `WipeLeft`, `WipeDown`, `WipeUp`, `Melt`, `ScrambleIn` and `Iris`. `intro.Into(asciiart.Dissolve, 900*time.Millisecond)` ends an intro by going into your app, which starts when the transition does. `intro.Fit(asciiart.FitCenter)` keeps a logo at its own size.
- **Casts:** `WriteCast(w, piece, seconds, fps)` writes an asciinema cast. `NewCastRecorder` records any views your app renders.

## ascii.rest pieces

With an [ascii.rest](https://github.com/bas3line/ascii) checkout in the repo root, the bundle also carries its 240 pieces (tech logos, companies, Linux distros and scenes) as `rest-<name>`. They work anywhere a slug does, and they're in the catalogue and the slug constants: `asciiart.MustSlug(slug.RestRust)`, `asciiart.FromSlug("rest-ubuntu")`.
They're checked against Node by the same parity test as the library's pieces. A few of their photo scenes take seconds to load, so load those before you need them.

## Examples

```bash
go run ./examples/gallery [slug]      # every piece; s cycles looks, f cycles fits
go run ./examples/background [slug]   # a panel over synthwave-grid
go run ./examples/intro [slug]        # a splash, then an app
go run ./examples/custom              # a native piece
go run ./examples/brand [logo.json]   # a logo intro into a live dashboard (extras)
```

## Performance

goja is an interpreter, about 3 to 4 times slower than QuickJS. On a modern laptop, 507 of 634 pieces draw at their full frame rate and 94 at half speed or better. The 33 below are heavy 3D, simulation and photo scenes, and play at the frame rate shown:

autumn-forest (10 fps), balloon-valley-sunrise (7), campfire-under-stars (11), castle-bridge-dawn (7), cherry-blossom-river (7), clifford-attractor (11), cloth-flag (12), concert-stage-crowd (11), double-helix (10), earth-rotating (9), flow-field (9), great-wall-sunset (7), growing-tree (6), gyroscope-rings (11), heart-3d (10), holi-colors (9), ink-in-water (6), klein-bottle (10), lava-cracks (8), machu-picchu-cloud (7), mobius-strip (12), munnar-tea-mist (2), nebula-drift (5), pixel-fire (9), reaction-diffusion (6), sphere-cube-morph (2), spinning-torus (12), spiral-galaxy (8), torus-knot (11), trefoil-tube (12), waterfall-canyon (9), waterfall (7), wireframe-city (10).

Light pieces such as `matrix-rain` and `synthwave-grid` take under 10 ms a frame. Loading a piece takes a few ms, except the photo scenes, which take 300 to 800 ms. Load those before you need them, for example at startup.

## Developing

The pieces are bundled by `scripts/bundle-native.mjs` in the repo root, which writes `pieces.bin` and `slug/slug.go`. Run `npm run native` after pulling upstream pieces or adding your own, then:

```bash
go test -short ./...                        # everything except the 2-minute parity test
go test ./...                               # plus every piece against Node's frames
go test -v -run Parity .                    # also prints the slowest pieces
AMA_DIFF=<slug> go test -run Parity -v .    # rows that differ from Node
```
