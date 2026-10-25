//! Colours: RGB, palettes keyed by single characters, and terminal colour modes.

use std::cell::RefCell;
use std::collections::HashMap;

use ratatui::style::Color;

/// A 24-bit colour.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Hash)]
pub struct Rgb(pub u8, pub u8, pub u8);

impl Rgb {
    /// Parse `#rrggbb` or `#rgb` (the `#` is optional).
    pub fn hex(s: &str) -> Option<Rgb> {
        let s = s.strip_prefix('#').unwrap_or(s);
        let v = |a: usize, b: usize| u8::from_str_radix(&s[a..b], 16).ok();
        match s.len() {
            6 => Some(Rgb(v(0, 2)?, v(2, 4)?, v(4, 6)?)),
            3 => Some(Rgb(v(0, 1)? * 17, v(1, 2)? * 17, v(2, 3)? * 17)),
            _ => None,
        }
    }

    /// Blend toward `other`: 0 keeps this colour, 1 gives `other`.
    pub fn mix(self, other: Rgb, f: f32) -> Rgb {
        let f = f.clamp(0.0, 1.0);
        let m = |a: u8, b: u8| (a as f32 + (b as f32 - a as f32) * f).round() as u8;
        Rgb(m(self.0, other.0), m(self.1, other.1), m(self.2, other.2))
    }

    /// Multiply every channel by `f` (0 to 1).
    pub fn scale(self, f: f32) -> Rgb {
        let s = |a: u8| (a as f32 * f.clamp(0.0, 1.0)).round() as u8;
        Rgb(s(self.0), s(self.1), s(self.2))
    }
}

/// The keys `palette()` hands out, in order: `0`-`9`, `a`-`z`, `A`-`Z`.
pub const KEYS: &str = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

/// A piece's colours, keyed by single ASCII characters. A space means the default ink.
#[derive(Clone, Debug, PartialEq)]
pub struct Palette {
    keys: [Option<Rgb>; 128],
}

impl Default for Palette {
    fn default() -> Self {
        Palette { keys: [None; 128] }
    }
}

impl Palette {
    /// An empty palette.
    pub fn new() -> Self {
        Self::default()
    }

    /// Colours under the keys `0`, `1`, ... `9`, `a`, ... like `palette()` in `lib/kit.js`.
    /// Invalid hex strings are skipped.
    pub fn from_hexes(hexes: &[&str]) -> Self {
        let mut p = Palette::new();
        for (key, hex) in KEYS.chars().zip(hexes) {
            if let Some(c) = Rgb::hex(hex) {
                p.set(key, c);
            }
        }
        p
    }

    /// Put a colour under a key. Non-ASCII keys are ignored.
    pub fn set(&mut self, key: char, color: Rgb) {
        if key.is_ascii() && key != ' ' {
            self.keys[key as usize] = Some(color);
        }
    }

    /// The colour under a key, if any.
    pub fn get(&self, key: char) -> Option<Rgb> {
        if key.is_ascii() {
            self.keys[key as usize]
        } else {
            None
        }
    }

    pub(crate) fn from_map<'a>(map: impl IntoIterator<Item = (&'a String, &'a String)>) -> Self {
        let mut p = Palette::new();
        for (k, hex) in map {
            if let (Some(key), Some(c)) = (k.chars().next(), Rgb::hex(hex)) {
                p.set(key, c);
            }
        }
        p
    }
}

/// How colours reach the terminal.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum ColorMode {
    /// 24-bit colour.
    TrueColor,
    /// The nearest of the 256 standard colours (macOS Terminal.app, older terminals).
    Ansi256,
    /// No colour at all (`NO_COLOR`).
    None,
}

impl ColorMode {
    /// Pick a mode from the environment, the same way the `ascii-magic-art` CLI does:
    /// `NO_COLOR` turns colour off, `COLORTERM=truecolor` and known terminals get 24-bit,
    /// everything else gets 256 colours.
    pub fn detect() -> ColorMode {
        let env = |k: &str| std::env::var(k).unwrap_or_default();
        if std::env::var_os("NO_COLOR").is_some() {
            return ColorMode::None;
        }
        let ct = env("COLORTERM").to_ascii_lowercase();
        let tp = env("TERM_PROGRAM");
        let known = [
            "iTerm",
            "WezTerm",
            "vscode",
            "ghostty",
            "Hyper",
            "Tabby",
            "WarpTerminal",
            "rio",
        ];
        if ct.contains("truecolor")
            || ct.contains("24bit")
            || env("FORCE_COLOR") == "3"
            || std::env::var_os("WT_SESSION").is_some()
            || (tp != "Apple_Terminal"
                && known
                    .iter()
                    .any(|k| tp.to_ascii_lowercase().contains(&k.to_ascii_lowercase())))
        {
            ColorMode::TrueColor
        } else {
            ColorMode::Ansi256
        }
    }

    /// The ratatui colour for an RGB value in this mode.
    pub fn color(self, c: Rgb) -> Option<Color> {
        match self {
            ColorMode::TrueColor => Some(Color::Rgb(c.0, c.1, c.2)),
            ColorMode::Ansi256 => Some(Color::Indexed(to256(c))),
            ColorMode::None => None,
        }
    }
}

thread_local! {
    static NEAR: RefCell<HashMap<Rgb, u8>> = RefCell::new(HashMap::new());
}

/// The nearest of the 240 standard colours (6x6x6 cube plus 24 greys) by "redmean"
/// distance, which weights the channels the way eyes do. Cached per thread.
pub fn to256(c: Rgb) -> u8 {
    if let Some(n) = NEAR.with(|m| m.borrow().get(&c).copied()) {
        return n;
    }
    const XLV: [i32; 6] = [0, 95, 135, 175, 215, 255];
    let (r, g, b) = (c.0 as f64, c.1 as f64, c.2 as f64);
    let (mut best, mut bd) = (16u8, f64::INFINITY);
    for n in 16..=255u8 {
        let (rr, gg, bb) = if n >= 232 {
            let v = 8 + (n as i32 - 232) * 10;
            (v, v, v)
        } else {
            let i = n as i32 - 16;
            (
                XLV[(i / 36) as usize],
                XLV[((i / 6) % 6) as usize],
                XLV[(i % 6) as usize],
            )
        };
        let (rr, gg, bb) = (rr as f64, gg as f64, bb as f64);
        let rm = (r + rr) / 2.0;
        let d = (2.0 + rm / 256.0) * (r - rr).powi(2)
            + 4.0 * (g - gg).powi(2)
            + (2.0 + (255.0 - rm) / 256.0) * (b - bb).powi(2);
        if d < bd {
            bd = d;
            best = n;
        }
    }
    NEAR.with(|m| m.borrow_mut().insert(c, best));
    best
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hex_and_mix() {
        assert_eq!(Rgb::hex("#7ee787"), Some(Rgb(0x7e, 0xe7, 0x87)));
        assert_eq!(Rgb::hex("fff"), Some(Rgb(255, 255, 255)));
        assert_eq!(Rgb::hex("#12345"), None);
        assert_eq!(Rgb(200, 100, 0).mix(Rgb(0, 0, 0), 0.5), Rgb(100, 50, 0));
    }

    #[test]
    fn nearest_256() {
        assert_eq!(to256(Rgb(255, 0, 0)), 196);
        assert_eq!(to256(Rgb(0, 0, 0)), 16);
        assert_eq!(to256(Rgb(128, 128, 128)), 244);
    }

    #[test]
    fn palette_keys() {
        let p = Palette::from_hexes(&["#000000", "#ffffff"]);
        assert_eq!(p.get('0'), Some(Rgb(0, 0, 0)));
        assert_eq!(p.get('1'), Some(Rgb(255, 255, 255)));
        assert_eq!(p.get('2'), None);
        assert_eq!(p.get(' '), None);
    }
}
