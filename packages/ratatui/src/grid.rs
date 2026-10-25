//! `Grid`: the drawing surface for your own pieces, a native port of the core of
//! `lib/kit.js`. Each cell holds a character and a palette key (a space is the default ink).

use crate::color::Palette;
use crate::frame::{Cell, Frame};

/// Character ramps, light to dark, as in `lib/kit.js`.
pub mod ramps {
    pub const CLASSIC: &str = " .:-=+*#%@";
    pub const FINE: &str = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
    pub const DOTS: &str = " .·•●";
    pub const BLOCKS: &str = " ░▒▓█";
    pub const SOFT: &str = " .,-~:;=!*#$@";
    pub const LINES: &str = " -=≡";
}
pub use ramps as RAMPS;

/// Map 0..1 to a character of a ramp: `ramp(0.5, RAMPS::CLASSIC)`.
pub fn ramp(v: f64, chars: &str) -> char {
    let n = chars.chars().count();
    let i = ((v * n as f64).floor().max(0.0) as usize).min(n.saturating_sub(1));
    chars.chars().nth(i).unwrap_or(' ')
}

/// Box corner and edge characters.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub enum BoxStyle {
    #[default]
    Light,
    Heavy,
    Double,
    Round,
    Ascii,
}

impl BoxStyle {
    /// Top-left, top-right, bottom-left, bottom-right, horizontal, vertical.
    fn chars(self) -> [char; 6] {
        match self {
            BoxStyle::Light => ['┌', '┐', '└', '┘', '─', '│'],
            BoxStyle::Heavy => ['┏', '┓', '┗', '┛', '━', '┃'],
            BoxStyle::Double => ['╔', '╗', '╚', '╝', '═', '║'],
            BoxStyle::Round => ['╭', '╮', '╰', '╯', '─', '│'],
            BoxStyle::Ascii => ['+', '+', '+', '+', '-', '|'],
        }
    }
}

/// A grid of characters and colour keys. Coordinates are `i32` so shapes can run off
/// the edges; anything outside is clipped.
#[derive(Clone, Debug)]
pub struct Grid {
    pub cols: u16,
    pub rows: u16,
    ch: Vec<char>,
    co: Vec<char>,
}

impl Grid {
    pub fn new(cols: u16, rows: u16) -> Grid {
        let n = cols as usize * rows as usize;
        Grid {
            cols,
            rows,
            ch: vec![' '; n],
            co: vec![' '; n],
        }
    }

    fn index(&self, x: i32, y: i32) -> Option<usize> {
        (x >= 0 && y >= 0 && x < self.cols as i32 && y < self.rows as i32)
            .then(|| x as usize + y as usize * self.cols as usize)
    }

    /// Blank every cell.
    pub fn clear(&mut self) -> &mut Self {
        self.ch.fill(' ');
        self.co.fill(' ');
        self
    }

    /// Put a character, and a colour key unless `co` is `None`.
    pub fn set(&mut self, x: i32, y: i32, ch: char, co: Option<char>) {
        if let Some(i) = self.index(x, y) {
            self.ch[i] = ch;
            if let Some(c) = co {
                self.co[i] = c;
            }
        }
    }

    /// The character at `x, y` (a space outside).
    pub fn get(&self, x: i32, y: i32) -> char {
        self.index(x, y).map_or(' ', |i| self.ch[i])
    }

    /// Write a string left to right.
    pub fn text(&mut self, x: i32, y: i32, s: &str, co: Option<char>) {
        for (i, ch) in s.chars().enumerate() {
            self.set(x + i as i32, y, ch, co);
        }
    }

    /// Write a multi-line block. Spaces are transparent unless `solid`.
    pub fn block(&mut self, x: i32, y: i32, s: &str, co: Option<char>, solid: bool) {
        for (r, line) in s.split('\n').enumerate() {
            for (i, ch) in line.chars().enumerate() {
                if solid || ch != ' ' {
                    self.set(x + i as i32, y + r as i32, ch, co);
                }
            }
        }
    }

    pub fn hline(&mut self, x0: i32, x1: i32, y: i32, ch: char, co: Option<char>) {
        for x in x0.min(x1)..=x0.max(x1) {
            self.set(x, y, ch, co);
        }
    }

    pub fn vline(&mut self, x: i32, y0: i32, y1: i32, ch: char, co: Option<char>) {
        for y in y0.min(y1)..=y0.max(y1) {
            self.set(x, y, ch, co);
        }
    }

    /// A box outline, `w x h` cells including the border.
    pub fn draw_box(&mut self, x: i32, y: i32, w: i32, h: i32, style: BoxStyle, co: Option<char>) {
        let [tl, tr, bl, br, hz, vt] = style.chars();
        self.hline(x + 1, x + w - 2, y, hz, co);
        self.hline(x + 1, x + w - 2, y + h - 1, hz, co);
        self.vline(x, y + 1, y + h - 2, vt, co);
        self.vline(x + w - 1, y + 1, y + h - 2, vt, co);
        self.set(x, y, tl, co);
        self.set(x + w - 1, y, tr, co);
        self.set(x, y + h - 1, bl, co);
        self.set(x + w - 1, y + h - 1, br, co);
    }

    pub fn fill(&mut self, x: i32, y: i32, w: i32, h: i32, ch: char, co: Option<char>) {
        for j in 0..h {
            for i in 0..w {
                self.set(x + i, y + j, ch, co);
            }
        }
    }

    /// A Bresenham line.
    pub fn line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, ch: char, co: Option<char>) {
        let (mut x0, mut y0, x1, y1) = (
            x0.round() as i32,
            y0.round() as i32,
            x1.round() as i32,
            y1.round() as i32,
        );
        let (dx, dy) = ((x1 - x0).abs(), -(y1 - y0).abs());
        let (sx, sy) = (if x0 < x1 { 1 } else { -1 }, if y0 < y1 { 1 } else { -1 });
        let mut e = dx + dy;
        for _ in 0..4000 {
            self.set(x0, y0, ch, co);
            if x0 == x1 && y0 == y1 {
                break;
            }
            let e2 = 2 * e;
            if e2 >= dy {
                e += dy;
                x0 += sx;
            }
            if e2 <= dx {
                e += dx;
                y0 += sy;
            }
        }
    }

    /// An ellipse outline, squashed by `aspect` (0.5 makes it round in tall terminal cells).
    pub fn circle(&mut self, cx: f64, cy: f64, r: f64, ch: char, co: Option<char>, aspect: f64) {
        let n = (r * 8.0).ceil().max(12.0) as usize;
        for i in 0..n {
            let a = i as f64 / n as f64 * std::f64::consts::TAU;
            self.set(
                (cx + a.cos() * r).round() as i32,
                (cy + a.sin() * r * aspect).round() as i32,
                ch,
                co,
            );
        }
    }

    /// Call `f(x, y, u, v)` for every cell, with `u, v` in 0..1. Return `Some((ch, key))` to draw.
    pub fn shade(&mut self, mut f: impl FnMut(i32, i32, f64, f64) -> Option<(char, Option<char>)>) {
        let (w, h) = (
            (self.cols as f64 - 1.0).max(1.0),
            (self.rows as f64 - 1.0).max(1.0),
        );
        for y in 0..self.rows as i32 {
            for x in 0..self.cols as i32 {
                if let Some((ch, co)) = f(x, y, x as f64 / w, y as f64 / h) {
                    self.set(x, y, ch, co);
                }
            }
        }
    }

    /// The finished frame, with keys resolved through `palette`.
    pub fn frame(&self, palette: &Palette) -> Frame {
        Frame {
            cols: self.cols,
            rows: self.rows,
            square: false,
            cells: self
                .ch
                .iter()
                .zip(&self.co)
                .map(|(&ch, &k)| Cell {
                    ch,
                    fg: palette.get(k),
                })
                .collect(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Rgb;

    #[test]
    fn draws_and_clips() {
        let mut g = Grid::new(6, 3);
        g.draw_box(0, 0, 6, 3, BoxStyle::Round, Some('0'));
        g.text(1, 1, "hello world", None);
        g.set(-1, 0, 'x', None);
        let f = g.frame(&Palette::from_hexes(&["#ff0000"]));
        assert_eq!(
            f.text(),
            "╭────╮\nhello \n╰────╯".replacen("hello ", "│hello", 1)
        );
        assert_eq!(f.get(0, 0).fg, Some(Rgb(255, 0, 0)));
        assert_eq!(ramp(0.0, RAMPS::CLASSIC), ' ');
        assert_eq!(ramp(1.0, RAMPS::CLASSIC), '@');
    }
}
