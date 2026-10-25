//! asciinema casts (asciicast v2) of pieces or of any ratatui screen.
//!
//! ```no_run
//! use ascii_magic_art_ratatui::{cast, JsPiece};
//! let mut piece = JsPiece::new("matrix-rain")?;
//! let file = std::fs::File::create("matrix.cast").unwrap();
//! cast::record(&mut piece, 6.0, 24.0, file).unwrap();
//! # Ok::<(), ascii_magic_art_ratatui::Error>(())
//! ```
//!
//! For your own UI, render each frame into a [`Buffer`] and hand it to a [`Recorder`].

use std::io::{self, Write};

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier};
use ratatui::widgets::Widget;

use crate::color::ColorMode;
use crate::piece::Piece;
use crate::widget::AsciiArt;

/// A buffer as ANSI text: 24-bit colour, lines joined by `\r\n`.
pub fn ansi(buf: &Buffer) -> String {
    let mut s = String::new();
    let a = buf.area;
    for y in a.top()..a.bottom() {
        if y > a.top() {
            s.push_str("\x1b[0m\r\n");
        }
        let (mut fg, mut bg, mut md) = (None, None, None);
        for x in a.left()..a.right() {
            let c = &buf[(x, y)];
            if fg != Some(c.fg) {
                s.push_str(&sgr(c.fg, false));
                fg = Some(c.fg);
            }
            if bg != Some(c.bg) {
                s.push_str(&sgr(c.bg, true));
                bg = Some(c.bg);
            }
            if md != Some(c.modifier) {
                s.push_str(if c.modifier.contains(Modifier::BOLD) {
                    "\x1b[1m"
                } else {
                    "\x1b[22m"
                });
                md = Some(c.modifier);
            }
            s.push_str(c.symbol());
        }
    }
    s.push_str("\x1b[0m");
    s
}

fn sgr(c: Color, bg: bool) -> String {
    let base = if bg { 40 } else { 30 };
    match c {
        Color::Reset => format!("\x1b[{}m", base + 9),
        Color::Rgb(r, g, b) => format!("\x1b[{};2;{r};{g};{b}m", base + 8),
        Color::Indexed(i) => format!("\x1b[{};5;{i}m", base + 8),
        Color::Black => format!("\x1b[{}m", base),
        Color::Red => format!("\x1b[{}m", base + 1),
        Color::Green => format!("\x1b[{}m", base + 2),
        Color::Yellow => format!("\x1b[{}m", base + 3),
        Color::Blue => format!("\x1b[{}m", base + 4),
        Color::Magenta => format!("\x1b[{}m", base + 5),
        Color::Cyan => format!("\x1b[{}m", base + 6),
        Color::Gray => format!("\x1b[{}m", base + 7),
        Color::DarkGray => format!("\x1b[{}m", base + 60),
        Color::LightRed => format!("\x1b[{}m", base + 61),
        Color::LightGreen => format!("\x1b[{}m", base + 62),
        Color::LightYellow => format!("\x1b[{}m", base + 63),
        Color::LightBlue => format!("\x1b[{}m", base + 64),
        Color::LightMagenta => format!("\x1b[{}m", base + 65),
        Color::LightCyan => format!("\x1b[{}m", base + 66),
        Color::White => format!("\x1b[{}m", base + 67),
    }
}

/// Writes an asciicast v2 file, one screen at a time.
pub struct Recorder<W: Write> {
    out: W,
    last: String,
}

impl<W: Write> Recorder<W> {
    /// Start a cast of a `width x height` terminal.
    pub fn new(mut out: W, width: u16, height: u16, title: &str) -> io::Result<Self> {
        let head = serde_json::json!({ "version": 2, "width": width, "height": height, "title": title, "env": { "TERM": "xterm-256color" } });
        writeln!(out, "{head}")?;
        writeln!(out, "{}", serde_json::json!([0.0, "o", "\x1b[?25l\x1b[2J"]))?;
        Ok(Recorder {
            out,
            last: String::new(),
        })
    }

    /// The screen at `t` seconds. Unchanged screens are left out.
    pub fn frame(&mut self, t: f64, buf: &Buffer) -> io::Result<()> {
        let s = format!("\x1b[H{}", ansi(buf));
        if s != self.last {
            writeln!(
                self.out,
                "{}",
                serde_json::json!([(t * 1e4).round() / 1e4, "o", s])
            )?;
            self.last = s;
        }
        Ok(())
    }

    /// End at `t` seconds, showing the cursor again.
    pub fn finish(mut self, t: f64) -> io::Result<W> {
        writeln!(self.out, "{}", serde_json::json!([t, "o", "\x1b[?25h"]))?;
        self.out.flush()?;
        Ok(self.out)
    }
}

/// Record `seconds` of a piece at `fps`, at its own size, in 24-bit colour.
pub fn record<P: Piece + ?Sized, W: Write>(
    piece: &mut P,
    seconds: f64,
    fps: f64,
    out: W,
) -> io::Result<W> {
    let m = piece.meta();
    let (w, h) = (m.cols, if m.square { m.rows.div_ceil(2) } else { m.rows });
    let mut rec = Recorder::new(out, w, h, &m.name.clone())?;
    let area = Rect::new(0, 0, w, h);
    let n = (seconds * fps).round().max(1.0) as usize;
    for i in 0..n {
        let t = i as f64 / fps;
        let frame = piece.draw(t);
        let mut buf = Buffer::empty(area);
        AsciiArt::new(&frame)
            .color_mode(ColorMode::TrueColor)
            .render(area, &mut buf);
        rec.frame(t, &buf)?;
    }
    rec.finish(seconds)
}
