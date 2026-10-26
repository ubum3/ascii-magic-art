---
name: ama-ratatui
description: Rust crate ascii-magic-art-ratatui (packages/ratatui): the 634 pieces as ratatui widgets, run in embedded QuickJS. Use to "add an ASCII background/splash screen to a Rust TUI", work with Player, AsciiArt, Intro, intro::run, Spec/Clip/Transition, a custom Piece + Grid, or the engine_parity test.
---

# ama-ratatui: ascii-magic-art for ratatui

## What it is

A Rust crate that draws any of the 634 `ascii-magic-art` pieces (plus ascii.rest's `rest-*` pieces when bundled) as ratatui 0.30 widgets: backgrounds, intros and splash screens. Library pieces are the real JS pieces, run in an embedded QuickJS (`rquickjs`) on each `Player`'s own thread; native Rust pieces implement `Piece`.
Lives in `packages/ratatui`. Crate name `ascii-magic-art-ratatui` (import as `ascii_magic_art_ratatui`), edition 2024, rust-version 1.88. Features: `crossterm` (default; `intro::run`, `transition::run`, examples) and `image` (`Spec::image`).

## Quick start

```toml
[dependencies]
ascii-magic-art-ratatui = { path = "/path/to/fork/packages/ratatui" }
ratatui = "0.30"

# QuickJS is C: build it optimised even in debug, or heavy pieces are several times slower
[profile.dev.package.rquickjs-sys]
opt-level = 3
```

```rust
use ascii_magic_art_ratatui::{AsciiArt, Player, slug};

let player = Player::from_slug(slug::MATRIX_RAIN)?;
let mut terminal = ratatui::init();
terminal.draw(|f| f.render_widget(AsciiArt::background(&player), f.area()))?;
ratatui::restore();
```

## Core API

Re-exports in `src/lib.rs`:

- **`Player`** (`src/player.rs`): `from_slug(&str) -> Result<Player, Error>`, `from_spec(impl Into<String>)`, `from_spec_with_look(..)`, `new<P: Piece + Send + 'static>(piece)`. Builders: `.speed(f64)`, `.still(bool)`, `.max_fps(f64)`, `.look(impl Into<Look>)`, `.start_at(f64)`. Controls (`&self`): `frame() -> Arc<Frame>` (never blocks), `frame_id()`, `wait_ready(Duration) -> bool`, `meta()`, `time()`, `error() -> Option<String>`, `is_paused`, `pause`, `resume`, `toggle_pause`, `seek(t)`, `set_speed`, `set_still`, `set_max_fps(Option<f64>)`, `set_look`, `set_state(impl Into<String>)`. Dropping it stops the thread.
- **`AsciiArt<'a>`** (`src/widget.rs`): `new(impl Into<FrameRef>)` (a `&Player`, `Arc<Frame>` or `&Frame`), `background(..)` (fill, dimmed). Builders: `fit(Fit)`, `align(Align)`, `dim(f32)`, `bg(Rgb)`, `ink(Rgb)`, `mono(Rgb)`, `color_mode(ColorMode)`, `transparent(bool)`. `Fit::{Center, Cover, Contain, Stretch, Tile}`.
- **`Intro`** (`src/intro.rs`): `new(Player)`, `from_slug(&str)`; `.title .subtitle .hint .fade_in .hold .fade_out .until_key() .fit .bg .accent .skippable .title_box`; `.start() -> IntroState` (`is_done`, `skip`, `alpha`, `was_skipped`, `player`). `intro::run(&mut DefaultTerminal, Intro) -> io::Result<Outcome>` with `Outcome::{Finished, Skipped, Quit}`; `intro::run_into(terminal, intro, Transition, Duration, |f| ..)`.
- **Looks**: `LookName::{Original, Dots, Ascii, Dense, Numbers, Binary, Letters, Blocks, Squares, Lines, Dither}` (`ALL`, `next()`), `Look { look, chars, mono, all, contrast, dot_size, density, steps }`, `Look::chars(" .oO@")`, `.mono(bool)`, `.all(bool)`, `.contrast(f64)`.
- **Extras**: `Spec::{text, progress(cols), sparkline(cols, rows), ticker(cols), celebrate(msg, Celebration), image_rgba, image, from_json}`, builders `.effect(TextEffect) .brand_effect(BrandEffect) .idle(BrandIdle) .colors(&[&str]) .duration .looped .set(key, value)`, `.to_json()`, `.player()`. `Clip::open(path)`, `Clip::from_bytes`. `Transition::{Wipe(Direction), Dissolve, Melt, Scramble, Iris}`, `transition::TransitionView::new(from, to, kind, progress)`, `transition::run(terminal, kind, duration, from_fn, to_fn)`. `cast::record(&mut piece, seconds, fps, out)`, `cast::Recorder`.
- **Native pieces**: `trait Piece { fn meta(&self) -> &Meta; fn draw(&mut self, t: f64) -> Frame; }`, `Meta::new(slug, cols, rows).fps(..).palette(Palette::from_hexes(&[..]))`, `Grid` (`set get text block hline vline draw_box fill line circle shade`, `frame(&palette)`), `ramp()`, `RAMPS`, `BoxStyle`.
- **Catalogue**: `slug::*` constants (e.g. `slug::MOONLIT_SEA`, `slug::REST_RUST`), `SLUGS`, `catalog() -> &'static [Meta]`, `meta(slug)`, `JsPiece::new(slug)`. `Error::{UnknownPiece { slug, suggestions }, Js { slug, message }}`.

## Common tasks

```rust
// 1. Splash, then your app over a dimmed background
let splash = Intro::from_slug(slug::MOONLIT_SEA)?.title("My App").subtitle("v1.0").hint("press any key");
if intro::run(&mut terminal, splash)? != intro::Outcome::Quit {
    let bg = Player::from_slug(slug::SYNTHWAVE_GRID)?;
    terminal.draw(|f| f.render_widget(AsciiArt::background(&bg), f.area()))?;
}
```

```rust
// 2. An ascii.rest piece (only when ./ascii was present at `npm run native`)
let rust = Player::from_slug(slug::REST_RUST)?;
let splash = Intro::from_slug("rest-ubuntu")?;
```

```rust
// 3. Specs from packages/extras, and state updates for data kinds
let logo = Player::from_spec(std::fs::read_to_string("logo.json")?)?; // ama-studio brand logo.svg -o logo.json
let text = Spec::text("DEPLOYED").effect(TextEffect::Scramble).player()?;
let bar = Spec::progress(40).set("label", "Uploading").player()?;
bar.set_state(r#"{"value": 0.42}"#);
let party = Spec::celebrate("Payment approved", Celebration::Check).player()?;
```

```rust
// 4. Looks and theming
let p = Player::from_slug("matrix-rain")?.look(LookName::Dots).speed(0.5).max_fps(20.0);
p.set_look(Look::chars(" .oO@").contrast(40.0));
f.render_widget(AsciiArt::new(&p).fit(Fit::Cover).dim(0.4).bg(Rgb(10, 10, 20)).mono(Rgb(0, 255, 120)), area);
```

```rust
// 5. A clip (read natively, no JS) and an intro that transitions into the app
let clip = Player::new(Clip::open("demo.amc")?);
intro::run_into(&mut terminal, splash, Transition::Dissolve, Duration::from_millis(700), |f| app.draw(f))?;
```

```rust
// 6. Record an asciinema cast of a piece
let mut piece = JsPiece::new("matrix-rain")?;
cast::record(&mut piece, 5.0, 15.0, std::fs::File::create("rain.cast")?)?;
```

Examples: `cargo run --release --example gallery|background|intro|custom|brand|wall` (`wall` reads `npx ama-wall` SSE on :8787).

## Testing and verification

```bash
cd packages/ratatui
cargo test                                                     # unit, widgets.rs, extras.rs, engine_parity.rs
cargo test --release --test engine_parity -- --nocapture       # parity + slowest pieces
AMA_DIFF=<slug> cargo test --test engine_parity -- --nocapture # rows that differ from Node
cd ../.. && node scripts/validate.mjs                          # must print 634/634 pieces pass
```

- `tests/engine_parity.rs` compares every catalogue piece at t = 0, 0.5, 1.5 with `packages/fixtures/golden.bin` (+ `rest-golden.bin`); pass threshold is 99% of cells. Clock pieces and `CHAOTIC` (`clifford-attractor`, `rest-starlings`) only get a size check.
- `tests/extras.rs` checks every extras fixture against `packages/fixtures/extras-golden.bin`, plus specs/state, pictures, clips, transitions and casts.
- If `golden.bin` is missing the parity test prints "skipped" and passes: make sure it actually ran.

## Rules and gotchas

- Additive only: never edit `pieces/`, `lib/`, `runtime/` or `bin/`.
- `assets/pieces.bin`, `src/catalog.rs` and the goldens are generated by `scripts/bundle-native.mjs`. Never hand-edit them; after changing the JS engine, extras, or pieces, run `npm run native` in the repo root. Existing goldens must stay byte-identical (check with `git diff --stat -- packages/fixtures`: only added fixtures, never changed ones).
- `npm run native` only bundles `rest-*` pieces when an ascii.rest checkout is at `./ascii`; without it `slug::REST_*` disappear.
- Copy the `[profile.dev.package.rquickjs-sys] opt-level = 3` block into any app crate; it does not propagate. A C compiler is required.
- `intro::run`, `intro::run_into` and `transition::run` need the `crossterm` feature; `Spec::image` needs `image`.
- Looks only apply to JS (library/spec) pieces, never to native `Piece`s.
- `player.frame()` returns the newest finished frame; heavy pieces drop frames (`munnar-tea-mist` ~5 fps, `sphere-cube-morph` ~7 fps). Photo scenes load in 100–400 ms: preload them, or use `wait_ready`.
- Photo pieces (`cell: "square"`) draw two pixels per cell with `▀`. Colour mode honours `NO_COLOR` and `COLORTERM=truecolor`; otherwise 256 colours.
- Render the art first, then widgets; put `Clear` under a panel to make it opaque.
- A bad slug returns `Error::UnknownPiece` with suggestions; `from_spec` fails immediately on a bad spec.
