//! Pieces made from data: extras specs. A spec is JSON naming a kind (a logo, text,
//! a progress bar, a sparkline, a ticker, a celebration or a picture) and how to draw
//! it. Make one here, or with the `ama-studio` CLI (`ama-studio brand logo.svg -o
//! logo.json`), and play it with [`Player::from_spec`].
//!
//! ```no_run
//! use ascii_magic_art_ratatui::{Spec, TextEffect};
//! let deployed = Spec::text("DEPLOYED").effect(TextEffect::Scramble).player()?;
//! let bar = Spec::progress(40).set("label", "Uploading").player()?;
//! bar.set_state(r#"{"value": 0.42}"#);
//! # Ok::<(), ascii_magic_art_ratatui::Error>(())
//! ```

use serde_json::{Map, Value, json};

use crate::Error;
use crate::engine::image_spec_from_rgba;
use crate::player::Player;

/// Entrances for text.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum TextEffect {
    Typewriter,
    Wave,
    Rainbow,
    Scramble,
    Glitch,
    Plain,
}

/// Entrances for a logo.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BrandEffect {
    Reveal,
    Draw,
    Assemble,
    Matrix,
    Glitch,
    Halftone,
    Spin3d,
    Shimmer,
}

/// What a logo does once it's in.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum BrandIdle {
    Shimmer,
    Still,
    Pulse,
    Rain,
}

/// How a celebration looks.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Celebration {
    Check,
    Confetti,
    Fireworks,
}

macro_rules! names {
    ($t:ty { $($v:ident => $s:literal),* $(,)? }) => {
        impl $t {
            /// The name the spec uses.
            pub fn as_str(self) -> &'static str {
                match self { $(Self::$v => $s),* }
            }
        }
    };
}
names!(TextEffect { Typewriter => "typewriter", Wave => "wave", Rainbow => "rainbow", Scramble => "scramble", Glitch => "glitch", Plain => "plain" });
names!(BrandEffect { Reveal => "reveal", Draw => "draw", Assemble => "assemble", Matrix => "matrix", Glitch => "glitch", Halftone => "halftone", Spin3d => "spin3d", Shimmer => "shimmer" });
names!(BrandIdle { Shimmer => "shimmer", Still => "still", Pulse => "pulse", Rain => "rain" });
names!(Celebration { Check => "check", Confetti => "confetti", Fireworks => "fireworks" });

/// A spec under construction. Any field the JS kind reads can be set with
/// [`set`](Spec::set); the typed methods cover the common ones.
#[derive(Clone, Debug, PartialEq)]
pub struct Spec(Map<String, Value>);

impl Spec {
    fn kind(kind: &str, fields: Value) -> Spec {
        let mut m = Map::new();
        m.insert("kind".into(), kind.into());
        if let Value::Object(f) = fields {
            m.extend(f);
        }
        Spec(m)
    }

    /// A spec from JSON, such as a file `ama-studio` wrote.
    pub fn from_json(json: &str) -> Result<Spec, Error> {
        match serde_json::from_str::<Value>(json) {
            Ok(Value::Object(m)) if m.get("kind").is_some_and(Value::is_string) => Ok(Spec(m)),
            Ok(_) => Err(bad("a spec is a JSON object with a \"kind\"")),
            Err(e) => Err(bad(&e.to_string())),
        }
    }

    /// Words in a 5-row block font. Default effect: scramble.
    pub fn text(text: impl Into<String>) -> Spec {
        Spec::kind("text", json!({ "text": text.into() }))
    }

    /// A progress bar `cols` wide. State: `{"value": 0..1, "label": "..."}`.
    pub fn progress(cols: u16) -> Spec {
        Spec::kind("progress", json!({ "cols": cols }))
    }

    /// A sparkline. State: `{"values": [...], "label": "..."}`.
    pub fn sparkline(cols: u16, rows: u16) -> Spec {
        Spec::kind("sparkline", json!({ "cols": cols, "rows": rows }))
    }

    /// A scrolling ticker. State: `{"items": [{"label": "VOL", "value": 12, "delta": 1.5}]}`.
    pub fn ticker(cols: u16) -> Spec {
        Spec::kind("ticker", json!({ "cols": cols }))
    }

    /// A celebration: a check that draws itself, confetti or fireworks, over a message.
    pub fn celebrate(message: impl Into<String>, style: Celebration) -> Spec {
        Spec::kind(
            "celebrate",
            json!({ "message": message.into(), "style": style.as_str() }),
        )
    }

    /// A picture from RGBA pixels, one per cell (`w x h`, already scaled). Square
    /// cells draw two per terminal cell with half blocks.
    pub fn image_rgba(rgba: &[u8], w: u16, h: u16, square: bool) -> Result<Spec, Error> {
        let json = image_spec_from_rgba(rgba, w, h, &json!({ "square": square }).to_string())?;
        Spec::from_json(&json)
    }

    /// A picture from an image, scaled to `cols` wide (rows follow its shape).
    #[cfg(feature = "image")]
    pub fn image(img: &image::DynamicImage, cols: u16, square: bool) -> Result<Spec, Error> {
        let aspect = if square { 1.0 } else { 1.0 / 0.602 };
        let rows = ((img.height() as f64 / img.width() as f64) * cols as f64 / aspect)
            .round()
            .max(1.0) as u16;
        let small = img
            .resize_exact(
                cols as u32,
                rows as u32,
                image::imageops::FilterType::Lanczos3,
            )
            .to_rgba8();
        Spec::image_rgba(small.as_raw(), cols, rows, square)
    }

    pub fn effect(self, e: TextEffect) -> Spec {
        self.set("effect", e.as_str())
    }

    pub fn brand_effect(self, e: BrandEffect) -> Spec {
        self.set("effect", e.as_str())
    }

    pub fn idle(self, i: BrandIdle) -> Spec {
        self.set("idle", i.as_str())
    }

    /// Hex colours: for text, main, accent and shadow; for data pieces, their own order.
    pub fn colors(self, colors: &[&str]) -> Spec {
        self.set("colors", colors.to_vec())
    }

    /// Seconds the entrance takes.
    pub fn duration(self, s: f64) -> Spec {
        self.set("duration", s)
    }

    /// Replay every `s` seconds.
    pub fn looped(self, s: f64) -> Spec {
        self.set("loop", s)
    }

    /// Set any field.
    pub fn set(mut self, key: &str, value: impl Into<Value>) -> Spec {
        self.0.insert(key.into(), value.into());
        self
    }

    pub fn get(&self, key: &str) -> Option<&Value> {
        self.0.get(key)
    }

    pub fn to_json(&self) -> String {
        Value::Object(self.0.clone()).to_string()
    }

    /// Play it.
    pub fn player(&self) -> Result<Player, Error> {
        Player::from_spec(self.to_json())
    }
}

fn bad(message: &str) -> Error {
    Error::Js {
        slug: "spec".into(),
        message: message.into(),
    }
}
