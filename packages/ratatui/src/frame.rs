//! One frame of a piece: a grid of characters, each with an optional colour.

use crate::color::{Palette, Rgb};

/// One cell: a character and its colour (`None` is the default ink).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Cell {
    pub ch: char,
    pub fg: Option<Rgb>,
}

impl Cell {
    pub const BLANK: Cell = Cell { ch: ' ', fg: None };
}

/// A frame, exactly `cols x rows` cells. Independent of any TUI library.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Frame {
    pub cols: u16,
    pub rows: u16,
    /// Photo-style pieces (`cell: "square"`): each cell is one pixel, and the widget
    /// draws two of them per terminal cell with the `▀` half block.
    pub square: bool,
    /// Row-major, `cols * rows` long.
    pub cells: Vec<Cell>,
}

impl Frame {
    /// An empty frame of a size.
    pub fn blank(cols: u16, rows: u16) -> Frame {
        Frame {
            cols,
            rows,
            square: false,
            cells: vec![Cell::BLANK; cols as usize * rows as usize],
        }
    }

    /// A frame from a piece's text and colour layers, the shape `draw(t)` returns in JS.
    /// Short rows and missing rows are padded with spaces, long ones cut, so the
    /// frame is always `cols x rows`.
    pub fn from_layers(
        text: &str,
        color: Option<&str>,
        palette: &Palette,
        cols: u16,
        rows: u16,
    ) -> Frame {
        let mut f = Frame::blank(cols, rows);
        let mut color_rows = color.map(|c| c.split('\n'));
        for (y, line) in text.split('\n').take(rows as usize).enumerate() {
            let crow = color_rows.as_mut().and_then(|c| c.next());
            let mut keys = crow.map(|c| c.chars());
            for (x, ch) in line.chars().take(cols as usize).enumerate() {
                let key = keys.as_mut().and_then(|k| k.next()).unwrap_or(' ');
                f.cells[y * cols as usize + x] = Cell {
                    ch,
                    fg: palette.get(key),
                };
            }
        }
        f
    }

    /// The cell at `x, y`, or a blank one outside the frame.
    pub fn get(&self, x: usize, y: usize) -> Cell {
        if x < self.cols as usize && y < self.rows as usize {
            self.cells[y * self.cols as usize + x]
        } else {
            Cell::BLANK
        }
    }

    /// The characters only, as lines joined by `\n`.
    pub fn text(&self) -> String {
        let mut s = String::with_capacity(self.cells.len() + self.rows as usize);
        for (i, row) in self.cells.chunks(self.cols.max(1) as usize).enumerate() {
            if i > 0 {
                s.push('\n');
            }
            s.extend(row.iter().map(|c| c.ch));
        }
        s
    }

    /// How many terminal rows the frame takes: square pieces pack two pixel rows into one.
    pub fn term_rows(&self) -> u16 {
        if self.square {
            self.rows.div_ceil(2)
        } else {
            self.rows
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn layers_are_padded_and_cut() {
        let pal = Palette::from_hexes(&["#ff0000"]);
        let f = Frame::from_layers("abcdef\nxy", Some("0 0\n"), &pal, 4, 3);
        assert_eq!(f.text(), "abcd\nxy  \n    ");
        assert_eq!(f.get(0, 0).fg, Some(Rgb(255, 0, 0)));
        assert_eq!(f.get(1, 0).fg, None);
        assert_eq!(f.get(2, 0).fg, Some(Rgb(255, 0, 0)));
        assert_eq!(f.get(9, 9), Cell::BLANK);
    }
}
