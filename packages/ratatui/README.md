# ascii-magic-art-ratatui

The 634 animated pieces from `ascii-magic-art` as [ratatui](https://ratatui.rs) widgets, for **backgrounds**, **intros** and **splash screens** in terminal apps.

- **`AsciiArt`** draws any piece into any area. It can fit it (`Center`, `Cover`, `Contain`, `Stretch`, `Tile`), dim it, and give it a background colour.
- **`AsciiArt::background`** fills the area edge to edge, dimmed, so you can render your UI on top.
- **`Intro`** fades a piece in, holds it, and fades it out, with a title card. Any key skips it. Run it in one line before your app with `intro::run`, or drive it from your own loop.
- **`Piece` and `Grid`** let you write your own pieces in Rust. They play exactly like library pieces.

The library pieces are the real JavaScript ones from this repo. Each runs in an embedded [QuickJS](https://github.com/DelSkayn/rquickjs) on its own thread, so all 634 pieces and all 11 looks are available. A test checks every piece against the frames Node draws.

## Install (local, from this fork)

```toml
# Cargo.toml
[dependencies]
ascii-magic-art-ratatui = { path = "/path/to/fork/packages/ratatui" }
ratatui = "0.30"

# QuickJS is C. Build it optimised even in debug, or heavy pieces draw several times slower.
[profile.dev.package.rquickjs-sys]
opt-level = 3
```

You need a C compiler for QuickJS, which `cc` finds the usual way. The pieces add about 2 MB to your binary.

## Quick start

```rust
use std::time::Duration;
use ascii_magic_art_ratatui::{intro, AsciiArt, Intro, Player, slug};
use ratatui::crossterm::event::{self, Event};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut terminal = ratatui::init();

    // A splash screen first. It returns Quit for Ctrl-C, Esc or q.
    let splash = Intro::from_slug(slug::MOONLIT_SEA)?.title("My App").subtitle("v1.0").hint("press any key");
    if intro::run(&mut terminal, splash)? != intro::Outcome::Quit {
        // Then your app, over a dimmed background.
        let bg = Player::from_slug(slug::SYNTHWAVE_GRID)?;
        loop {
            terminal.draw(|f| {
                f.render_widget(AsciiArt::background(&bg), f.area());
                // ... your widgets, on top
            })?;
            if event::poll(Duration::from_millis(33))? && matches!(event::read()?, Event::Key(_)) {
                break;
            }
        }
    }
    ratatui::restore();
    Ok(())
}
```

`slug::` has a constant for every piece, so names complete in your editor. `SLUGS` lists them all, and `catalog()` returns the meta of every piece: name, category, note, tags, size and fps. The pieces are listed at [ascii-magic.com/ascii](https://www.ascii-magic.com/ascii).

## Player

A `Player` plays one piece on its own thread. `player.frame()` never blocks: it returns the newest finished frame. A heavy piece drops frames instead of stalling your input handling.

```rust
let p = Player::from_slug("matrix-rain")?   // a bad slug errors with suggestions
    .speed(0.5)
    .look(LookName::Dots)                    // or Look::chars(" .oO@"), Look { contrast: Some(40.0), .. }
    .max_fps(20.0)
    .start_at(3.0);
p.pause(); p.resume(); p.toggle_pause(); p.seek(10.0); p.set_look(LookName::Binary);
p.frame_id();   // goes up with every new frame, if you only want to redraw on change
p.error();      // why the piece failed, if it did
```

Dropping the player stops its thread.

## AsciiArt

```rust
AsciiArt::new(&player)         // or an Arc<Frame>, or a &Frame
    .fit(Fit::Cover)           // Center (default), Cover, Contain, Stretch, Tile
    .align(Align::Bottom)
    .dim(0.4)                  // 0 full strength, 1 gone (blends toward bg)
    .bg(Rgb(10, 10, 20))       // paint the whole area
    .mono(Rgb(0, 255, 120))
    .transparent(true)         // leave blank cells untouched
    .color_mode(ColorMode::Ansi256)
```

- **Colour mode** is detected the same way the `ascii-magic-art` CLI detects it. `NO_COLOR` turns colour off. `COLORTERM=truecolor` and known terminals get 24-bit colour. Everything else, including macOS Terminal.app, gets the nearest of the 256 standard colours.
- **Photo pieces** (`cell: "square"`, such as `ocean-sunset`) draw two pixels per cell with `▀`.
- **Backgrounds:** render the art first, then your widgets. Widgets that only draw text leave the art showing between their characters. Put `Clear` under a panel to make it solid.

## Intro

```rust
let splash = Intro::new(player)          // or Intro::from_slug("...")
    .title("ACME").subtitle("v2.4").hint("press any key")
    .fade_in(Duration::from_millis(400)).hold(Duration::from_secs(3)).fade_out(Duration::from_millis(600))
    .until_key()                         // or hold until a key instead of a fixed time
    .accent(Rgb(255, 216, 107)).bg(Rgb(0, 0, 0)).fit(Fit::Cover);
```

`intro::run(&mut terminal, splash)` returns `Finished`, `Skipped` or `Quit`. In your own loop, use `let state = splash.start();` and then:
- render `&state` each frame
- call `state.skip()` on a key
- move on when `state.is_done()`

## Your own pieces

```rust
use ascii_magic_art_ratatui::{BoxStyle, Frame, Grid, Meta, Palette, Piece, Player};

struct Badge { meta: Meta, grid: Grid }

impl Piece for Badge {
    fn meta(&self) -> &Meta { &self.meta }
    fn draw(&mut self, t: f64) -> Frame {           // t: seconds -> exactly cols x rows
        let g = &mut self.grid;
        g.clear();
        g.draw_box(0, 0, 20, 3, BoxStyle::Round, Some('1'));
        g.text(2, 1, &format!("build #{}", t as u32), Some('0'));  // '0' = first palette colour
        g.frame(&self.meta.palette)
    }
}

let meta = Meta::new("badge", 20, 3).fps(12.0).palette(Palette::from_hexes(&["#7ee787", "#8b949e"]));
let player = Player::new(Badge { meta, grid: Grid::new(20, 3) });
```

`Grid` has `set`, `get`, `text`, `block`, `hline`, `vline`, `draw_box`, `fill`, `line`, `circle` and `shade`, plus `ramp()` and `RAMPS`, as in `lib/kit.js`. Looks only apply to library pieces.

## Examples

```bash
cargo run --release --example gallery [slug]      # every piece; s cycles looks, f cycles fits
cargo run --release --example background [slug]   # a dashboard over synthwave-grid
cargo run --release --example intro [slug]        # a splash, then an app
cargo run --release --example custom              # a native piece
```

## Performance

On a modern laptop, 629 of 634 pieces draw at their full frame rate in QuickJS. The mean is 8.6 ms per frame. Two run below half speed: `munnar-tea-mist` (about 5 fps) and `sphere-cube-morph` (about 7 fps). Loading a piece takes about 2 ms, except the photo scenes, which take 100 to 400 ms.

## Developing

The pieces are bundled by `scripts/bundle-native.mjs` in the repo root, which writes `assets/pieces.bin` and `src/catalog.rs`. Run `npm run native` after pulling upstream pieces or adding your own, then:

```bash
cargo test                                                   # unit, widget and parity tests
cargo test --release --test engine_parity -- --nocapture     # also prints the slowest pieces
AMA_DIFF=<slug> cargo test --test engine_parity -- --nocapture   # rows that differ from Node
```

The parity test compares every piece with `packages/fixtures/golden.bin`, which holds Node's frames. Two kinds of piece only get a size check: the two that read the clock, and the chaotic `clifford-attractor`.
