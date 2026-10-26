---
name: ama-bubbletea
description: Go package asciiart (packages/bubbletea): the 634 pieces as Bubble Tea v2 components, run in goja. Use to "add an ASCII background/splash screen to a Go TUI", work with asciiart.Model, FromSlug, Background/Overlay, intro.New, FromSpec/SetState, clips, transitions, a custom Piece + Grid, or the Go parity tests.
---

# ama-bubbletea: ascii-magic-art for Bubble Tea

## What it is

A Go package (name `asciiart`) that plays any of the 634 `ascii-magic-art` pieces (plus ascii.rest's `rest-*` pieces when bundled) as Bubble Tea v2 components: backgrounds, intros and splash screens. Library pieces are the real JS pieces run in goja (pure Go, no cgo); your own pieces implement `Piece`.
Lives in `packages/bubbletea`. Module `github.com/ubum3/ascii-magic-art/packages/bubbletea` (Go 1.26.4), with subpackages `intro` and `slug`. Depends on `charm.land/bubbletea/v2` and `charm.land/lipgloss/v2`.

## Quick start

```bash
go get github.com/ubum3/ascii-magic-art/packages/bubbletea
# before it's pushed:
go mod edit -replace github.com/ubum3/ascii-magic-art/packages/bubbletea=/path/to/fork/packages/bubbletea
```

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
    if _, err := tea.NewProgram(splash).Run(); err != nil { panic(err) }
}
```

## Core API

- **Constructors** (`model.go`): `New(piece Piece, opts ...Option) Model`, `FromSlug(slug string, opts ...Option) (Model, error)`, `MustSlug(slug, opts...) Model`, `FromSpec(spec string, opts ...Option) (Model, error)`.
- **Options**: `WithSize(w, h)`, `WithFit(Fit)`, `WithAlign(Align)`, `WithDim(float64)`, `WithBackground(RGB)`, `WithMono(RGB)`, `WithLook(Look)`, `WithSpeed(float64)`, `WithStill()`, `WithMaxFPS(float64)`, `WithStart(t)`.
- **Model methods**: `Init() tea.Cmd`, `Update(tea.Msg) (Model, tea.Cmd)`, `View() string`. Setters (pointer): `SetSize`, `SetFit`, `SetDim`, `SetStyle`, `Pause()`; returning `tea.Cmd`: `Resume`, `TogglePause`, `Seek(t)`, `SetSpeed(s)`, `SetLook(l)`, `SetState(v any)`. Getters: `Frame()`, `Meta()`, `Time()`, `Err()`, `Ready()`, `Paused()`, `Size()`, `Style()`.
- **Layout**: `Fit`: `FitCenter` (default), `FitCover`, `FitContain`, `FitStretch`, `FitTile`. `Align`: `AlignCenter`, `AlignTopLeft`, `AlignBottom`, ... `Background(art, content string, w, h int) string`, `Overlay(base, content string, x, y int) string`, `Render(*Frame, Style) string`.
- **Looks** (`piece.go`): `LookName` consts `Original, Dots, ASCII, Dense, Numbers, Binary, Letters, Blocks, Squares, Lines, Dither`; `Looks`, `.Next()`; `Look{Look, Chars, Mono, All, Contrast *float64, DotSize *float64, Density *float64, Steps *int}`, `LookOf(name)`.
- **Specs** (`spec.go`): `type Spec map[string]any`; `TextSpec`, `ProgressSpec(cols)`, `SparklineSpec(cols, rows)`, `TickerSpec(cols)`, `CelebrateSpec(msg, Celebration)`, `ImageSpec(img image.Image, cols, square)`, `ParseSpec([]byte)`; builders `.With(k, v) .Effect(TextEffect) .BrandEffect(BrandEffect) .Colors(...) .Duration(s) .Loop(s) .JSON() .Model(opts...)`. Consts: `Typewriter, Wave, Rainbow, Scramble, Glitch, PlainText`; `Reveal, Draw, Assemble, Matrix, Glitchy, Halftone, Spin3D, Shimmer`; `Check, Confetti, Fireworks`.
- **Clips / transitions / casts**: `OpenClip(path)`, `LoadClip(io.Reader)` (`*Clip` is a `Piece`); `Transition(kind, from, to string, w, h int, p float64) string` with `Dissolve, WipeRight, WipeLeft, WipeDown, WipeUp, Melt, ScrambleIn, Iris` (`Transitions`); `WriteCast(w, piece, seconds, fps)`, `NewCastRecorder(w, width, height, title)`.
- **Native pieces**: `type Piece interface { Meta() Meta; Draw(t float64) Frame }`; `NewMeta(slug, cols, rows)`, `NewPalette(hex...)`, `NewGrid(cols, rows)` (`Set Get Text Block HLine VLine Box Fill Line Circle Shade`, `Frame(&palette)`), `BoxRound`, `NoKey`, `Ramp`, `Ramps`.
- **Catalogue**: `slug.*` constants (`slug.SynthwaveGrid`, `slug.RestRust`), `slug.All`, `Catalog() []Meta`, `MetaOf(slug)`, `NewJSPiece(slug, look)`. Errors: `*UnknownPieceError` (with suggestions), `*JSError`.
- **intro** package: `intro.New(art asciiart.Model, next tea.Model, opts...) *Model`; options `Title, Subtitle, Hint, FadeIn, Hold, FadeOut, UntilKey(), Skippable, Accent, Background, TitleBox, Fit, AltScreen, Into(kind, d)`.

## Common tasks

```go
// 1. A background: pass EVERY message to the art model, frames arrive as messages
func (m model) Init() tea.Cmd { return m.art.Init() }
func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
    if s, ok := msg.(tea.WindowSizeMsg); ok { m.w, m.h = s.Width, s.Height; m.art.SetSize(m.w, m.h) }
    var cmd tea.Cmd
    m.art, cmd = m.art.Update(msg)
    return m, cmd
}
func (m model) View() tea.View {
    v := tea.NewView(asciiart.Background(m.art.View(), panel, m.w, m.h)); v.AltScreen = true; return v
}
// art, err := asciiart.FromSlug(slug.SynthwaveGrid, asciiart.WithFit(asciiart.FitCover), asciiart.WithDim(0.6))
```

```go
// 2. An ascii.rest piece
art := asciiart.MustSlug(slug.RestRust)
ubuntu, err := asciiart.FromSlug("rest-ubuntu")
```

```go
// 3. Specs from packages/extras and state updates (return the cmd from Update)
logo, err := asciiart.FromSpec(string(logoJSON)) // ama-studio brand logo.svg -o logo.json
bar, err := asciiart.ProgressSpec(40).With("label", "Uploading").Model()
cmd := bar.SetState(map[string]any{"value": 0.42})
party, err := asciiart.CelebrateSpec("Payment approved", asciiart.Check).Model()
```

```go
// 4. Looks and theming
c := 40.0
art, _ := asciiart.FromSlug("matrix-rain", asciiart.WithLook(asciiart.Look{Look: asciiart.Dots, Contrast: &c}),
    asciiart.WithMono(asciiart.RGB{0, 255, 120}), asciiart.WithBackground(asciiart.RGB{10, 10, 20}))
cmd := art.SetLook(asciiart.Look{Chars: " .oO@"})
```

```go
// 5. A clip, and an intro that transitions into the app
clip, err := asciiart.OpenClip("demo.amc") // ama-studio convert demo.mp4 -o demo.amc
m := asciiart.New(clip)
splash := intro.New(asciiart.MustSlug(slug.MoonlitSea), app, intro.Into(asciiart.Dissolve, 900*time.Millisecond), intro.Fit(asciiart.FitCenter))
```

Examples: `go run ./examples/gallery|background|intro|custom|brand|wall` (`wall` reads `npx ama-wall`).

## Testing and verification

```bash
cd packages/bubbletea
go test -short ./...                        # everything except the ~2-minute parity test
go test ./...                               # plus TestParityWithNode: every piece vs Node
go test -v -run Parity .                    # also prints the slowest pieces
AMA_DIFF=<slug> go test -run Parity -v .    # rows that differ from Node
go vet ./...
cd ../.. && node scripts/validate.mjs       # must print 634/634 pieces pass
```

`TestParityWithNode` uses `packages/fixtures/golden.bin`; `TestExtrasParityWithNode` uses `extras-golden.bin`. Both must stay green, and `go test -short` alone does not run the piece parity test. A missing golden file makes these tests `t.Skip`, not fail, so check they actually ran (`-v`).

## Rules and gotchas

- Additive only: never edit `pieces/`, `lib/`, `runtime/` or `bin/`.
- `pieces.bin` and `slug/slug.go` are generated by `scripts/bundle-native.mjs`. Never hand-edit; after changing the JS engine, extras or pieces, run `npm run native` in the repo root. Existing goldens in `packages/fixtures/` must stay byte-identical.
- `rest-*` pieces and `slug.Rest*` only exist if an ascii.rest checkout was at `./ascii` when `npm run native` ran.
- `Model.Update` returns `(asciiart.Model, tea.Cmd)`, not `tea.Model`: assign `m.art, cmd = m.art.Update(msg)` and return `cmd`. Dropping messages or the cmd freezes the art.
- `Resume`, `TogglePause`, `Seek`, `SetSpeed`, `SetLook`, `SetState` return a `tea.Cmd` that must be returned from your `Update` (a paused/still model needs it to redraw). They have pointer receivers.
- `View()` returns a string; wrap in `tea.NewView` yourself. Every cell of content passed to `Background`, spaces included, covers the art.
- goja is 3–4x slower than QuickJS: 33 heavy pieces play below half speed (`munnar-tea-mist`, `sphere-cube-morph` ~2 fps). Photo scenes load in 300–800 ms: load them at startup.
- Looks only apply to library/spec pieces, not native `Piece`s. Colours are 24-bit; Bubble Tea downsamples and honours `NO_COLOR`.
- Brand glitch is `Glitchy` and plain text is `PlainText` (Go names differ from the JSON values).
- After the intro, your model gets `Init` and then a `tea.WindowSizeMsg`. Ctrl-C, Esc and `q` quit the intro.
