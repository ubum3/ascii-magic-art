//! The library pieces: the embedded bundle, its catalog, and `JsPiece`, which runs one
//! piece in QuickJS.

use std::collections::{BTreeMap, HashMap};
use std::io::Read;
use std::sync::OnceLock;

use rquickjs::{CatchResultExt, Context, Function, Object, Runtime};
use serde::Deserialize;

use crate::Error;
use crate::color::Palette;
use crate::frame::Frame;
use crate::look::Look;
use crate::piece::{Meta, Piece};

/// Made by `scripts/bundle-native.mjs`: "AMA1", u32 LE index length, JSON index, deflate blobs.
static BIN: &[u8] = include_bytes!("../assets/pieces.bin");

#[derive(Deserialize)]
struct RawIndex {
    prelude: (usize, usize),
    extras: Option<(usize, usize)>,
    pieces: Vec<RawPiece>,
}

/// The meta a spec reports from JS.
#[derive(Deserialize)]
struct SpecMeta {
    slug: String,
    name: String,
    #[serde(default)]
    category: String,
    #[serde(default)]
    note: String,
    #[serde(default)]
    tags: Vec<String>,
    cols: u16,
    rows: u16,
    fps: f64,
    #[serde(default)]
    cell: Option<String>,
    #[serde(default)]
    palette: Option<BTreeMap<String, String>>,
}

#[derive(Deserialize)]
struct RawPiece {
    slug: String,
    name: String,
    category: String,
    note: String,
    tags: Vec<String>,
    cols: u16,
    rows: u16,
    fps: f64,
    square: bool,
    palette: Option<BTreeMap<String, String>>,
    clock: bool,
    off: usize,
    len: usize,
}

struct Asset {
    metas: Vec<Meta>,
    blobs: Vec<(usize, usize)>,
    by_slug: HashMap<String, usize>,
    data: &'static [u8],
    prelude: String,
    extras: Option<(usize, usize)>,
}

fn asset() -> &'static Asset {
    static ASSET: OnceLock<Asset> = OnceLock::new();
    ASSET.get_or_init(|| {
        assert_eq!(
            &BIN[..4],
            b"AMA1",
            "assets/pieces.bin is not a piece bundle"
        );
        let n = u32::from_le_bytes(BIN[4..8].try_into().unwrap()) as usize;
        let index: RawIndex =
            serde_json::from_slice(&BIN[8..8 + n]).expect("assets/pieces.bin: bad index");
        let data = &BIN[8 + n..];
        let mut metas = Vec::with_capacity(index.pieces.len());
        let mut blobs = Vec::with_capacity(index.pieces.len());
        let mut by_slug = HashMap::new();
        for p in index.pieces {
            by_slug.insert(p.slug.clone(), metas.len());
            blobs.push((p.off, p.len));
            metas.push(Meta {
                slug: p.slug,
                name: p.name,
                category: p.category,
                note: p.note,
                tags: p.tags,
                cols: p.cols,
                rows: p.rows,
                fps: p.fps,
                square: p.square,
                palette: p
                    .palette
                    .as_ref()
                    .map(Palette::from_map)
                    .unwrap_or_default(),
                clock: p.clock,
            });
        }
        let prelude = inflate(data, index.prelude);
        Asset {
            metas,
            blobs,
            by_slug,
            data,
            prelude,
            extras: index.extras,
        }
    })
}

fn inflate(data: &[u8], (off, len): (usize, usize)) -> String {
    let mut s = String::new();
    flate2::read::DeflateDecoder::new(&data[off..off + len])
        .read_to_string(&mut s)
        .expect("assets/pieces.bin: bad blob");
    s
}

/// The extras script (specs: logos, text, data, pictures), inflated once.
fn extras_source() -> Result<&'static str, String> {
    static SRC: OnceLock<Option<String>> = OnceLock::new();
    SRC.get_or_init(|| asset().extras.map(|at| inflate(asset().data, at)))
        .as_deref()
        .ok_or_else(|| "this pieces.bin has no extras: run `npm run native`".to_string())
}

/// Every library piece, sorted by slug.
pub fn catalog() -> &'static [Meta] {
    &asset().metas
}

/// One library piece's meta, by slug.
pub fn meta(slug: &str) -> Option<&'static Meta> {
    let a = asset();
    a.by_slug.get(slug).map(|&i| &a.metas[i])
}

/// Up to three slugs close to a misspelt one.
pub(crate) fn suggest(slug: &str) -> Vec<String> {
    let mut scored: Vec<(usize, &str)> = catalog()
        .iter()
        .map(|m| {
            let d = if m.slug.contains(slug) || slug.contains(m.slug.as_str()) {
                0
            } else {
                levenshtein(slug, &m.slug)
            };
            (d, m.slug.as_str())
        })
        .filter(|&(d, _)| d <= (slug.len() / 3).max(2))
        .collect();
    scored.sort();
    scored
        .into_iter()
        .take(3)
        .map(|(_, s)| s.to_string())
        .collect()
}

fn levenshtein(a: &str, b: &str) -> usize {
    let b: Vec<char> = b.chars().collect();
    let mut prev: Vec<usize> = (0..=b.len()).collect();
    for (i, ca) in a.chars().enumerate() {
        let mut cur = vec![i + 1];
        for (j, &cb) in b.iter().enumerate() {
            cur.push(
                (prev[j] + (ca != cb) as usize)
                    .min(prev[j + 1] + 1)
                    .min(cur[j] + 1),
            );
        }
        prev = cur;
    }
    prev[b.len()]
}

pub(crate) fn unknown(slug: &str) -> Error {
    Error::UnknownPiece {
        slug: slug.to_string(),
        suggestions: suggest(slug),
    }
}

/// A library piece running in its own QuickJS runtime.
///
/// A runtime belongs to one thread, so `JsPiece` is not `Send`. To play a piece
/// from anywhere, use a [`Player`](crate::Player), which builds it on its own thread.
pub struct JsPiece {
    meta: Meta,
    /// The spec's JSON, for a piece made from a spec (so a new look can remake it).
    spec: Option<String>,
    state: Option<String>,
    palette: Palette,
    handle: i32,
    error: Option<String>,
    last: Frame,
    // Dropped in this order: the context before its runtime.
    ctx: Context,
    _rt: Runtime,
}

impl JsPiece {
    /// Load a piece by slug.
    pub fn new(slug: &str) -> Result<JsPiece, Error> {
        JsPiece::with_look(slug, &Look::default())
    }

    /// Load a piece by slug, drawn in a look.
    pub fn with_look(slug: &str, look: &Look) -> Result<JsPiece, Error> {
        let a = asset();
        let &i = a.by_slug.get(slug).ok_or_else(|| unknown(slug))?;
        let meta = a.metas[i].clone();
        let js = |message: String| Error::Js {
            slug: slug.to_string(),
            message,
        };
        let rt = Runtime::new().map_err(|e| js(e.to_string()))?;
        let ctx = Context::full(&rt).map_err(|e| js(e.to_string()))?;
        let source = inflate(a.data, a.blobs[i]);
        ctx.with(|ctx| -> Result<(), Error> {
            ctx.eval::<(), _>(a.prelude.as_str())
                .catch(&ctx)
                .map_err(|e| js(e.to_string()))?;
            ctx.eval::<(), _>(source)
                .catch(&ctx)
                .map_err(|e| js(e.to_string()))?;
            Ok(())
        })?;
        let last = Frame {
            square: meta.square,
            ..Frame::blank(meta.cols, meta.rows)
        };
        let mut p = JsPiece {
            palette: meta.palette.clone(),
            meta,
            spec: None,
            state: None,
            handle: -1,
            error: None,
            last,
            ctx,
            _rt: rt,
        };
        p.make(look)?;
        Ok(p)
    }

    /// A piece made from an extras spec (JSON): a logo, text, a data piece or a
    /// picture. See `packages/extras` and [`Spec`](crate::Spec) for the shapes.
    pub fn from_spec(spec: &str) -> Result<JsPiece, Error> {
        JsPiece::from_spec_with_look(spec, &Look::default())
    }

    /// A piece made from a spec, drawn in a look.
    pub fn from_spec_with_look(spec: &str, look: &Look) -> Result<JsPiece, Error> {
        let a = asset();
        let js = |message: String| Error::Js {
            slug: "spec".to_string(),
            message,
        };
        let extras = extras_source().map_err(js)?;
        let rt = Runtime::new().map_err(|e| js(e.to_string()))?;
        let ctx = Context::full(&rt).map_err(|e| js(e.to_string()))?;
        let (handle, meta_json) = ctx.with(|ctx| -> Result<(i32, String), Error> {
            ctx.eval::<(), _>(a.prelude.as_str())
                .catch(&ctx)
                .map_err(|e| js(e.to_string()))?;
            ctx.eval::<(), _>(extras)
                .catch(&ctx)
                .map_err(|e| js(e.to_string()))?;
            let r = (|| -> rquickjs::Result<(i32, String)> {
                let ama: Object = ctx.globals().get("__ama")?;
                let h: i32 = ama
                    .get::<_, Function>("makeSpec")?
                    .call((spec, look.to_json()))?;
                let m: String = ama.get::<_, Function>("meta")?.call((h,))?;
                Ok((h, m))
            })();
            r.catch(&ctx).map_err(|e| js(e.to_string()))
        })?;
        let m: SpecMeta = serde_json::from_str(&meta_json).map_err(|e| js(e.to_string()))?;
        let meta = Meta {
            slug: m.slug,
            name: m.name,
            category: m.category,
            note: m.note,
            tags: m.tags,
            cols: m.cols,
            rows: m.rows,
            fps: m.fps,
            square: m.cell.as_deref() == Some("square"),
            palette: m
                .palette
                .as_ref()
                .map(Palette::from_map)
                .unwrap_or_default(),
            clock: false,
        };
        let last = Frame {
            square: meta.square,
            ..Frame::blank(meta.cols, meta.rows)
        };
        Ok(JsPiece {
            palette: meta.palette.clone(),
            meta,
            spec: Some(spec.to_string()),
            state: None,
            handle,
            error: None,
            last,
            ctx,
            _rt: rt,
        })
    }

    fn make(&mut self, look: &Look) -> Result<(), Error> {
        let (slug, old) = (self.meta.slug.clone(), self.handle);
        let (spec, state) = (self.spec.clone(), self.state.clone());
        let h = self.ctx.with(|ctx| {
            let r = (|| -> rquickjs::Result<i32> {
                let ama: Object = ctx.globals().get("__ama")?;
                if old >= 0 {
                    ama.get::<_, Function>("drop")?.call::<_, ()>((old,))?;
                }
                let h: i32 = match &spec {
                    Some(spec) => ama
                        .get::<_, Function>("makeSpec")?
                        .call((spec.as_str(), look.to_json()))?,
                    None => ama
                        .get::<_, Function>("make")?
                        .call((slug.as_str(), look.to_json()))?,
                };
                if let Some(s) = &state {
                    ama.get::<_, Function>("setState")?
                        .call::<_, ()>((h, s.as_str()))?;
                }
                Ok(h)
            })();
            r.catch(&ctx).map_err(|e| e.to_string())
        });
        self.handle = h.map_err(|message| Error::Js { slug, message })?;
        self.palette = self.meta.palette.clone();
        Ok(())
    }

    /// Give a data spec (progress, sparkline, ticker, celebrate) its state, as JSON:
    /// `{"value": 0.4}`. Every frame from now on draws it.
    pub fn try_set_state(&mut self, state: &str) -> Result<(), Error> {
        let h = self.handle;
        let r = self.ctx.with(|ctx| {
            let r = (|| -> rquickjs::Result<()> {
                let ama: Object = ctx.globals().get("__ama")?;
                ama.get::<_, Function>("setState")?.call((h, state))
            })();
            r.catch(&ctx).map_err(|e| e.to_string())
        });
        r.map_err(|message| Error::Js {
            slug: self.meta.slug.clone(),
            message,
        })?;
        self.state = Some(state.to_string());
        Ok(())
    }

    /// The frame at `t` seconds, or the error the piece threw.
    pub fn try_draw(&mut self, t: f64) -> Result<Frame, Error> {
        let h = self.handle;
        let s = self.ctx.with(|ctx| {
            let r = (|| -> rquickjs::Result<String> {
                let ama: Object = ctx.globals().get("__ama")?;
                ama.get::<_, Function>("draw")?.call((h, t))
            })();
            r.catch(&ctx).map_err(|e| e.to_string())
        });
        let s = s.map_err(|message| Error::Js {
            slug: self.meta.slug.clone(),
            message,
        })?;
        let mut parts = s.splitn(3, '\0');
        let (text, color, pal) = (
            parts.next().unwrap_or(""),
            parts.next().unwrap_or(""),
            parts.next().unwrap_or(""),
        );
        if !pal.is_empty()
            && let Ok(map) = serde_json::from_str::<BTreeMap<String, String>>(pal)
        {
            self.palette = Palette::from_map(&map);
        }
        let color = (!color.is_empty()).then_some(color);
        let mut f = Frame::from_layers(text, color, &self.palette, self.meta.cols, self.meta.rows);
        f.square = self.meta.square;
        Ok(f)
    }

    /// Switch to another look, keeping the same runtime.
    pub fn try_set_look(&mut self, look: &Look) -> Result<(), Error> {
        self.make(look)
    }
}

impl Piece for JsPiece {
    fn meta(&self) -> &Meta {
        &self.meta
    }

    /// The frame at `t`. If the piece throws, the last good frame comes back and
    /// [`error`](Piece::error) says why.
    fn draw(&mut self, t: f64) -> Frame {
        match self.try_draw(t) {
            Ok(f) => {
                self.error = None;
                self.last = f.clone();
                f
            }
            Err(e) => {
                self.error = Some(e.to_string());
                self.last.clone()
            }
        }
    }

    fn set_look(&mut self, look: &Look) {
        if let Err(e) = self.make(look) {
            self.error = Some(e.to_string());
        }
    }

    fn set_state(&mut self, state: &str) {
        if let Err(e) = self.try_set_state(state) {
            self.error = Some(e.to_string());
        }
    }

    fn error(&self) -> Option<&str> {
        self.error.as_deref()
    }
}

/// RGBA pixels (one per cell, `w x h`) to an image spec, with the same quantiser the
/// studio CLI and the browser use. `opts` is JSON: `{"colors": 48, "square": true,
/// "motion": {"glint": true}}`.
pub fn image_spec_from_rgba(rgba: &[u8], w: u16, h: u16, opts: &str) -> Result<String, Error> {
    let js = |message: String| Error::Js {
        slug: "image".to_string(),
        message,
    };
    if rgba.len() != w as usize * h as usize * 4 {
        return Err(js(format!("{} bytes is not {w}x{h} RGBA", rgba.len())));
    }
    let a = asset();
    let extras = extras_source().map_err(js)?;
    let rt = Runtime::new().map_err(|e| js(e.to_string()))?;
    let ctx = Context::full(&rt).map_err(|e| js(e.to_string()))?;
    // One char per byte: the cheapest way to hand bytes to the engine.
    let latin1: String = rgba.iter().map(|&b| b as char).collect();
    ctx.with(|ctx| {
        let r = (|| -> rquickjs::Result<String> {
            ctx.eval::<(), _>(a.prelude.as_str())?;
            ctx.eval::<(), _>(extras)?;
            let ama: Object = ctx.globals().get("__ama")?;
            ama.get::<_, Function>("imageSpec")?
                .call((latin1.as_str(), w, h, opts))
        })();
        r.catch(&ctx).map_err(|e| js(e.to_string()))
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn catalog_and_suggestions() {
        assert!(catalog().len() > 600);
        assert_eq!(
            meta("spinning-torus").map(|m| (m.cols, m.rows)),
            Some((48, 24))
        );
        assert!(suggest("spining-torus").contains(&"spinning-torus".to_string()));
        assert!(matches!(
            JsPiece::new("nope-nope"),
            Err(Error::UnknownPiece { .. })
        ));
    }

    #[test]
    fn draws_and_restyles() {
        let mut p = JsPiece::new("spinning-torus").unwrap();
        let f = p.try_draw(1.0).unwrap();
        assert_eq!((f.cols, f.rows, f.cells.len()), (48, 24, 48 * 24));
        assert!(f.text().contains('@') || f.text().contains('#'));
        p.try_set_look(&Look::from(crate::LookName::Dots)).unwrap();
        assert!(p.try_draw(1.0).unwrap().text().contains('●'));
    }
}
