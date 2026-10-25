//! `.amc` clips: frames recorded from a video, a GIF or any piece, by `ama-studio
//! convert clip.mp4 -o clip.amc`. A clip is a [`Piece`] that picks a frame by time,
//! so it needs no JS engine.

use std::collections::BTreeMap;
use std::io::Read;
use std::path::Path;

use serde::Deserialize;

use crate::Error;
use crate::color::Palette;
use crate::frame::Frame;
use crate::piece::{Meta, Piece};

#[derive(Deserialize)]
struct Header {
    cols: u16,
    rows: u16,
    fps: f64,
    frames: usize,
    #[serde(default)]
    square: bool,
    #[serde(default = "yes")]
    r#loop: bool,
    #[serde(default)]
    palette: Option<BTreeMap<String, String>>,
    #[serde(default)]
    name: Option<String>,
}

fn yes() -> bool {
    true
}

/// A decoded clip. Cheap to clone the frames out of; `Send`, so a [`Player`](crate::Player) can play it.
#[derive(Clone, Debug)]
pub struct Clip {
    meta: Meta,
    frames: Vec<Frame>,
    looped: bool,
}

fn bad(message: impl Into<String>) -> Error {
    Error::Js {
        slug: "clip".into(),
        message: message.into(),
    }
}

impl Clip {
    /// Read a clip file.
    pub fn open(path: impl AsRef<Path>) -> Result<Clip, Error> {
        let bytes = std::fs::read(path.as_ref())
            .map_err(|e| bad(format!("{}: {e}", path.as_ref().display())))?;
        Clip::from_bytes(&bytes)
    }

    /// Decode clip bytes ("AMC1", u32 LE header length, JSON header, raw deflate frames).
    pub fn from_bytes(bytes: &[u8]) -> Result<Clip, Error> {
        if bytes.len() < 8 || &bytes[..4] != b"AMC1" {
            return Err(bad("not an .amc clip"));
        }
        let n = u32::from_le_bytes(bytes[4..8].try_into().unwrap()) as usize;
        let head = bytes
            .get(8..8 + n)
            .ok_or_else(|| bad("clip header cut short"))?;
        let h: Header = serde_json::from_slice(head).map_err(|e| bad(e.to_string()))?;
        let mut body = String::new();
        flate2::read::DeflateDecoder::new(&bytes[8 + n..])
            .read_to_string(&mut body)
            .map_err(|e| bad(e.to_string()))?;
        let palette = h
            .palette
            .as_ref()
            .map(Palette::from_map)
            .unwrap_or_default();
        let mut parts = body.split('\0');
        let mut frames = Vec::with_capacity(h.frames);
        while frames.len() < h.frames {
            let (Some(text), Some(color)) = (parts.next(), parts.next()) else {
                break;
            };
            let mut f = Frame::from_layers(
                text,
                (!color.is_empty()).then_some(color),
                &palette,
                h.cols,
                h.rows,
            );
            f.square = h.square;
            frames.push(f);
        }
        if frames.is_empty() {
            return Err(bad("the clip has no frames"));
        }
        let name = h.name.unwrap_or_else(|| "clip".into());
        let mut meta = Meta::new(name.clone(), h.cols, h.rows)
            .name(name)
            .fps(h.fps)
            .palette(palette);
        meta.category = "extras".into();
        meta.square = h.square;
        Ok(Clip {
            meta,
            frames,
            looped: h.r#loop,
        })
    }

    pub fn frames(&self) -> &[Frame] {
        &self.frames
    }

    /// Seconds in one pass.
    pub fn duration(&self) -> f64 {
        self.frames.len() as f64 / self.meta.fps
    }
}

impl Piece for Clip {
    fn meta(&self) -> &Meta {
        &self.meta
    }

    fn draw(&mut self, t: f64) -> Frame {
        let n = self.frames.len() as i64;
        let i = (t * self.meta.fps).floor() as i64;
        let i = if self.looped {
            i.rem_euclid(n)
        } else {
            i.clamp(0, n - 1)
        };
        self.frames[i as usize].clone()
    }
}
