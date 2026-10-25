//! The 634 animated pieces of [ascii-magic-art](https://www.ascii-magic.com/ascii) as
//! [ratatui](https://ratatui.rs) widgets: backgrounds, intros and splash screens.
//!
//! ```no_run
//! use ascii_magic_art_ratatui::{AsciiArt, Player, slug};
//!
//! let player = Player::from_slug(slug::MATRIX_RAIN)?;
//! # let mut terminal = ratatui::init();
//! terminal.draw(|f| f.render_widget(AsciiArt::background(&player), f.area()))?;
//! # ratatui::restore();
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! Library pieces run in an embedded QuickJS engine, each in its own runtime on the
//! [`Player`]'s thread, so a slow piece drops frames instead of blocking your UI.
//! Your own pieces implement [`Piece`], usually drawing into a [`Grid`].

pub mod cast;
mod catalog;
mod clip;
mod color;
mod engine;
mod frame;
mod grid;
pub mod intro;
mod look;
mod piece;
mod player;
mod spec;
pub mod transition;
mod widget;

pub use catalog::{SLUGS, slug};
pub use clip::Clip;
pub use color::{ColorMode, KEYS, Palette, Rgb, to256};
pub use engine::{JsPiece, catalog, image_spec_from_rgba, meta};
pub use frame::{Cell, Frame};
pub use grid::{BoxStyle, Grid, RAMPS, ramp};
pub use intro::{Intro, IntroState};
pub use look::{Look, LookName};
pub use piece::{Meta, Piece};
pub use player::Player;
pub use spec::{BrandEffect, BrandIdle, Celebration, Spec, TextEffect};
pub use transition::{Direction, Transition};
pub use widget::{Align, AsciiArt, Fit, FrameRef};

/// What can go wrong loading or drawing a piece.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    /// No library piece has this slug. `suggestions` holds close matches.
    UnknownPiece {
        slug: String,
        suggestions: Vec<String>,
    },
    /// The piece threw in the JS engine.
    Js { slug: String, message: String },
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::UnknownPiece { slug, suggestions } if suggestions.is_empty() => {
                write!(f, "no piece \"{slug}\"")
            }
            Error::UnknownPiece { slug, suggestions } => {
                write!(
                    f,
                    "no piece \"{slug}\" (did you mean {}?)",
                    suggestions.join(", ")
                )
            }
            Error::Js { slug, message } => write!(f, "\"{slug}\" failed: {message}"),
        }
    }
}

impl std::error::Error for Error {}

#[cfg(test)]
mod piece_test {
    use crate::{Frame, Grid, Meta, Palette, Piece};

    /// A tiny native piece for tests: a bar that moves one column per second.
    pub struct Stripes {
        meta: Meta,
        grid: Grid,
    }

    impl Stripes {
        pub fn new() -> Self {
            Stripes {
                meta: Meta::new("stripes", 8, 2).palette(Palette::from_hexes(&["#ff0000"])),
                grid: Grid::new(8, 2),
            }
        }
    }

    impl Piece for Stripes {
        fn meta(&self) -> &Meta {
            &self.meta
        }
        fn draw(&mut self, t: f64) -> Frame {
            self.grid.clear();
            let x = t.floor() as i32 % 8;
            self.grid.vline(x, 0, 1, '#', Some('0'));
            self.grid.frame(&self.meta.palette)
        }
    }
}
