//! The piece contract: metadata plus `draw(t)`, a function from seconds to a frame.

use crate::color::Palette;
use crate::frame::Frame;
use crate::look::Look;

/// What a piece is: its name, size, frame rate and colours.
#[derive(Clone, Debug, PartialEq)]
pub struct Meta {
    pub slug: String,
    pub name: String,
    pub category: String,
    pub note: String,
    pub tags: Vec<String>,
    pub cols: u16,
    pub rows: u16,
    pub fps: f64,
    /// Photo-style piece: one pixel per cell, drawn with half blocks.
    pub square: bool,
    pub palette: Palette,
    /// The piece reads the clock (`Date`), so it isn't a pure function of `t`.
    pub clock: bool,
}

impl Meta {
    /// Meta for your own piece: named after its slug, category `custom`, 24 fps.
    pub fn new(slug: impl Into<String>, cols: u16, rows: u16) -> Meta {
        let slug = slug.into();
        Meta {
            name: slug.clone(),
            slug,
            category: "custom".into(),
            note: String::new(),
            tags: Vec::new(),
            cols,
            rows,
            fps: 24.0,
            square: false,
            palette: Palette::new(),
            clock: false,
        }
    }

    pub fn name(mut self, name: impl Into<String>) -> Self {
        self.name = name.into();
        self
    }

    pub fn fps(mut self, fps: f64) -> Self {
        self.fps = fps;
        self
    }

    pub fn palette(mut self, palette: Palette) -> Self {
        self.palette = palette;
        self
    }
}

/// Anything that draws frames over time. Library pieces are [`JsPiece`](crate::JsPiece);
/// implement this for your own, usually with a [`Grid`](crate::Grid).
///
/// Keep `draw` a function of `t` alone where you can: the player may skip frames,
/// seek, or start part-way through.
pub trait Piece {
    fn meta(&self) -> &Meta;

    /// The frame at `t` seconds. Exactly `meta().cols x meta().rows`.
    fn draw(&mut self, t: f64) -> Frame;

    /// Switch to another look. Library pieces support this; the default does nothing.
    fn set_look(&mut self, _look: &Look) {}

    /// The last error, if drawing failed (library pieces only).
    fn error(&self) -> Option<&str> {
        None
    }
}

impl<P: Piece + ?Sized> Piece for Box<P> {
    fn meta(&self) -> &Meta {
        (**self).meta()
    }
    fn draw(&mut self, t: f64) -> Frame {
        (**self).draw(t)
    }
    fn set_look(&mut self, look: &Look) {
        (**self).set_look(look)
    }
    fn error(&self) -> Option<&str> {
        (**self).error()
    }
}
