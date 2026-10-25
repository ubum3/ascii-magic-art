//! `AsciiArt`: the widget that draws a frame into a ratatui buffer.

use std::sync::{Arc, OnceLock};

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier};
use ratatui::widgets::Widget;

use crate::color::{ColorMode, Rgb};
use crate::frame::Frame;
use crate::player::Player;

/// How the art fills the area.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Fit {
    /// Actual size, placed by [`Align`]. Cropped if the area is smaller.
    #[default]
    Center,
    /// Scaled to fill the area edge to edge, cropping one axis (like CSS `cover`).
    Cover,
    /// Scaled to fit inside the area, the whole piece visible.
    Contain,
    /// Scaled to the area on both axes, ignoring the aspect ratio.
    Stretch,
    /// Actual size, repeated to fill the area.
    Tile,
}

/// Where the art sits when it doesn't fill the area exactly.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum Align {
    TopLeft,
    Top,
    TopRight,
    Left,
    #[default]
    Center,
    Right,
    BottomLeft,
    Bottom,
    BottomRight,
}

impl Align {
    fn factors(self) -> (f64, f64) {
        use Align::*;
        let x = match self {
            TopLeft | Left | BottomLeft => 0.0,
            Top | Center | Bottom => 0.5,
            _ => 1.0,
        };
        let y = match self {
            TopLeft | Top | TopRight => 0.0,
            Left | Center | Right => 0.5,
            _ => 1.0,
        };
        (x, y)
    }
}

/// A frame to draw: borrowed, or shared from a [`Player`].
#[derive(Clone, Debug)]
pub enum FrameRef<'a> {
    Borrowed(&'a Frame),
    Shared(Arc<Frame>),
}

impl std::ops::Deref for FrameRef<'_> {
    type Target = Frame;
    fn deref(&self) -> &Frame {
        match self {
            FrameRef::Borrowed(f) => f,
            FrameRef::Shared(f) => f,
        }
    }
}

impl<'a> From<&'a Frame> for FrameRef<'a> {
    fn from(f: &'a Frame) -> Self {
        FrameRef::Borrowed(f)
    }
}

impl From<Arc<Frame>> for FrameRef<'_> {
    fn from(f: Arc<Frame>) -> Self {
        FrameRef::Shared(f)
    }
}

impl From<&Player> for FrameRef<'_> {
    fn from(p: &Player) -> Self {
        FrameRef::Shared(p.frame())
    }
}

/// The default ink for cells with no colour, when the art is dimmed or faded.
const INK: Rgb = Rgb(204, 204, 204);

pub(crate) fn detected() -> ColorMode {
    static MODE: OnceLock<ColorMode> = OnceLock::new();
    *MODE.get_or_init(ColorMode::detect)
}

/// Draws a frame: from a [`Player`], an `Arc<Frame>` or a `&Frame`.
///
/// ```no_run
/// # use ascii_magic_art_ratatui::*;
/// # let player = Player::from_slug("synthwave-grid").unwrap();
/// # let (area, buf) = (ratatui::layout::Rect::default(), &mut ratatui::buffer::Buffer::empty(Default::default()));
/// use ratatui::widgets::Widget;
/// AsciiArt::new(&player).fit(Fit::Cover).dim(0.4).render(area, buf);
/// ```
#[derive(Clone, Debug)]
pub struct AsciiArt<'a> {
    frame: FrameRef<'a>,
    fit: Fit,
    align: Align,
    dim: f32,
    bg: Option<Rgb>,
    ink: Rgb,
    mono: Option<Rgb>,
    mode: Option<ColorMode>,
    transparent: bool,
}

impl<'a> AsciiArt<'a> {
    pub fn new(frame: impl Into<FrameRef<'a>>) -> Self {
        AsciiArt {
            frame: frame.into(),
            fit: Fit::Center,
            align: Align::Center,
            dim: 0.0,
            bg: None,
            ink: INK,
            mono: None,
            mode: None,
            transparent: false,
        }
    }

    /// Art for behind your widgets: [`Fit::Cover`] and dimmed by half. Render it
    /// first, then the rest of your UI on top.
    pub fn background(frame: impl Into<FrameRef<'a>>) -> Self {
        AsciiArt::new(frame).fit(Fit::Cover).dim(0.5)
    }

    pub fn fit(mut self, fit: Fit) -> Self {
        self.fit = fit;
        self
    }

    pub fn align(mut self, align: Align) -> Self {
        self.align = align;
        self
    }

    /// Blend the art toward the background colour: 0 is full strength, 1 is gone.
    pub fn dim(mut self, dim: f32) -> Self {
        self.dim = dim.clamp(0.0, 1.0);
        self
    }

    /// Paint this background behind the whole area (and blend toward it when dimming).
    pub fn bg(mut self, bg: Rgb) -> Self {
        self.bg = Some(bg);
        self
    }

    /// The colour of cells with no palette colour, used when dimming. Default light grey.
    pub fn ink(mut self, ink: Rgb) -> Self {
        self.ink = ink;
        self
    }

    /// Draw every cell in one colour.
    pub fn mono(mut self, color: Rgb) -> Self {
        self.mono = Some(color);
        self
    }

    /// Override the colour mode, which by default comes from the environment.
    pub fn color_mode(mut self, mode: ColorMode) -> Self {
        self.mode = Some(mode);
        self
    }

    /// Leave cells where the art is blank untouched, so what's under them shows.
    pub fn transparent(mut self, on: bool) -> Self {
        self.transparent = on;
        self
    }

    /// The character, foreground and background of a terminal cell of the art.
    /// Square pieces pack two pixel rows into one cell with the upper half block.
    fn cell(&self, f: &Frame, x: usize, y: usize) -> (char, Option<Rgb>, Option<Rgb>) {
        if !f.square {
            let c = f.get(x, y);
            return (c.ch, c.fg, None);
        }
        let px = |y: usize| -> Rgb {
            let c = f.get(x, y);
            let Some(rgb) = c.fg else { return Rgb(0, 0, 0) };
            let level = match c.ch {
                '▁' => 0.14,
                '▂' => 0.26,
                '▃' => 0.38,
                '▄' => 0.51,
                '▅' => 0.64,
                '▆' => 0.76,
                '▇' => 0.88,
                '█' => 1.0,
                ' ' => 0.0,
                _ => 0.8,
            };
            rgb.scale((level * 1.25f32).min(1.0))
        };
        if self.mode == Some(ColorMode::None)
            || (self.mode.is_none() && detected() == ColorMode::None)
        {
            return (f.get(x, 2 * y).ch, None, None);
        }
        ('▀', Some(px(2 * y)), Some(px(2 * y + 1)))
    }
}

impl Widget for AsciiArt<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        (&self).render(area, buf);
    }
}

impl Widget for &AsciiArt<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        let area = area.intersection(buf.area);
        let f = &*self.frame;
        let (vw, vh) = (f.cols as f64, f.term_rows() as f64);
        if area.is_empty() || vw == 0.0 || vh == 0.0 {
            return;
        }
        let (w, h) = (area.width as f64, area.height as f64);
        // Target cells per source cell, on each axis.
        let (kx, ky) = match self.fit {
            Fit::Center | Fit::Tile => (1.0, 1.0),
            Fit::Cover => {
                let k = (w / vw).max(h / vh);
                (k, k)
            }
            Fit::Contain => {
                let k = (w / vw).min(h / vh);
                (k, k)
            }
            Fit::Stretch => (w / vw, h / vh),
        };
        let (ax, ay) = self.align.factors();
        let (ox, oy) = if self.fit == Fit::Tile {
            (0.0, 0.0)
        } else {
            ((w - vw * kx) * ax, (h - vh * ky) * ay)
        };
        // Whole cells, rounding toward the top-left when a crop doesn't split evenly.
        let (ox, oy) = (ox.ceil(), oy.ceil());
        let mode = self.mode.unwrap_or_else(detected);
        let base = self.bg.unwrap_or(Rgb(0, 0, 0));
        let paint = |c: Option<Rgb>| -> Option<Rgb> {
            let c = self.mono.or(c);
            if self.dim > 0.0 {
                Some(c.unwrap_or(self.ink).mix(base, self.dim))
            } else {
                c
            }
        };
        let bg_color = self.bg.and_then(|b| mode.color(b));
        for ty in 0..area.height {
            for tx in 0..area.width {
                let mut sx = ((tx as f64 + 0.5 - ox) / kx).floor() as i64;
                let mut sy = ((ty as f64 + 0.5 - oy) / ky).floor() as i64;
                if self.fit == Fit::Tile {
                    sx = sx.rem_euclid(vw as i64);
                    sy = sy.rem_euclid(vh as i64);
                }
                let cell = &mut buf[(area.x + tx, area.y + ty)];
                if sx < 0 || sy < 0 || sx >= vw as i64 || sy >= vh as i64 {
                    if let Some(b) = bg_color {
                        cell.set_char(' ').set_fg(Color::Reset).set_bg(b);
                    }
                    continue;
                }
                let (ch, fg, px_bg) = self.cell(f, sx as usize, sy as usize);
                if self.transparent && ch == ' ' && px_bg.is_none() {
                    continue;
                }
                cell.set_char(ch);
                cell.modifier = Modifier::empty();
                cell.set_fg(
                    paint(fg)
                        .and_then(|c| mode.color(c))
                        .unwrap_or(Color::Reset),
                );
                match px_bg {
                    Some(p) => {
                        cell.set_bg(
                            paint(Some(p))
                                .and_then(|c| mode.color(c))
                                .unwrap_or(Color::Reset),
                        );
                    }
                    None => {
                        if let Some(b) = bg_color {
                            cell.set_bg(b);
                        }
                    }
                }
            }
        }
    }
}
