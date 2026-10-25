//! Your own piece in Rust: a `Piece` drawn into a `Grid`, played like any other.
//! It also works as a background or an intro. `q` quits.
//!
//!     cargo run --release --example custom

use std::time::Duration;

use ascii_magic_art_ratatui::{
    AsciiArt, BoxStyle, Frame, Grid, Meta, Palette, Piece, Player, RAMPS, ramp,
};
use ratatui::crossterm::event::{self, Event, KeyCode};

/// A plasma field with a build badge on top.
struct BuildBadge {
    meta: Meta,
    grid: Grid,
}

impl BuildBadge {
    fn new() -> Self {
        let (cols, rows) = (60, 15);
        let palette = Palette::from_hexes(&["#7ee787", "#8b949e", "#1f6feb", "#58a6ff", "#a5d6ff"]);
        BuildBadge {
            meta: Meta::new("build-badge", cols, rows)
                .name("Build Badge")
                .fps(24.0)
                .palette(palette),
            grid: Grid::new(cols, rows),
        }
    }
}

impl Piece for BuildBadge {
    fn meta(&self) -> &Meta {
        &self.meta
    }

    fn draw(&mut self, t: f64) -> Frame {
        let g = &mut self.grid;
        g.clear();
        // Plasma: a sum of sines, shaded with a ramp and coloured by value.
        g.shade(|x, y, _, _| {
            let (x, y) = (x as f64, y as f64 * 2.0);
            let v = ((x * 0.11 + t).sin()
                + (y * 0.13 - t * 0.7).sin()
                + ((x + y) * 0.07 + t * 0.5).sin())
                / 6.0
                + 0.5;
            let key = ['2', '3', '4'][((v * 3.0) as usize).min(2)];
            Some((ramp(v, RAMPS::CLASSIC), Some(key)))
        });
        let (w, x, y) = (30, 15, 5);
        g.fill(x, y, w, 5, ' ', Some(' '));
        g.draw_box(x, y, w, 5, BoxStyle::Round, Some('1'));
        g.text(x + 3, y + 1, "build-badge", Some('1'));
        g.text(
            x + 3,
            y + 2,
            &format!("✓ build #{} passed", 1200 + t as u32),
            Some('0'),
        );
        let bar = ((t % 4.0) / 4.0 * 24.0) as i32;
        g.hline(x + 3, x + 3 + bar, y + 3, '━', Some('0'));
        g.frame(&self.meta.palette)
    }
}

fn main() -> std::io::Result<()> {
    let player = Player::new(BuildBadge::new());
    ratatui::run(|terminal| {
        loop {
            terminal.draw(|f| f.render_widget(AsciiArt::new(&player), f.area()))?;
            if event::poll(Duration::from_millis(16))?
                && let Event::Key(k) = event::read()?
                && matches!(k.code, KeyCode::Char('q') | KeyCode::Esc)
            {
                return Ok(());
            }
        }
    })
}
