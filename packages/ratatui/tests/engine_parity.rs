//! Every library piece, drawn in QuickJS, against the frame Node drew
//! (`packages/fixtures/golden.bin`, from `npm run native` in the repo root).
//!
//! Engines can differ in the last bit of `Math.sin` and friends, which can flip the
//! odd shading character, so a piece passes at 99% of cells matching. Pieces that
//! read the clock, and chaotic ones, only get a size check.
//!
//! `cargo test --release --test engine_parity -- --nocapture` also prints the slowest pieces,
//! and `AMA_DIFF=<slug>` prints the rows of one piece that differ.

use std::collections::HashMap;
use std::io::Read;
use std::time::Instant;

use ascii_magic_art_ratatui::{JsPiece, catalog};

/// Chaotic orbits: one last-bit difference in `sin()` over 60,000 steps gives a different,
/// equally valid picture. Size check only, like the clock pieces.
const CHAOTIC: &[&str] = &["clifford-attractor"];

fn golden() -> Option<HashMap<String, (String, String)>> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/golden.bin");
    let raw = std::fs::read(path).ok()?;
    let mut s = String::new();
    flate2::read::DeflateDecoder::new(&raw[..])
        .read_to_string(&mut s)
        .ok()?;
    serde_json::from_str(&s).ok()
}

#[test]
fn every_piece_matches_node() {
    let Some(golden) = golden() else {
        eprintln!("no packages/fixtures/golden.bin (outside the repo?): skipped");
        return;
    };
    let (mut bad, mut times) = (Vec::new(), Vec::new());
    for meta in catalog() {
        let start = Instant::now();
        let mut p = JsPiece::new(&meta.slug).unwrap_or_else(|e| panic!("{e}"));
        let load = start.elapsed();
        let mut f = None;
        let draw = Instant::now();
        for t in [0.0, 0.5, 1.5] {
            f = Some(p.try_draw(t).unwrap_or_else(|e| panic!("{e}")));
        }
        let per_frame = draw.elapsed() / 3;
        times.push((per_frame, load, meta.slug.as_str()));
        let f = f.unwrap();
        assert_eq!(
            (f.cols, f.rows, f.cells.len()),
            (
                meta.cols,
                meta.rows,
                meta.cols as usize * meta.rows as usize
            ),
            "{}",
            meta.slug
        );
        if meta.clock || CHAOTIC.contains(&meta.slug.as_str()) {
            continue;
        }
        let (text, color) = &golden[&meta.slug];
        let want = ascii_magic_art_ratatui::Frame::from_layers(
            text,
            (!color.is_empty()).then_some(color.as_str()),
            &meta.palette,
            meta.cols,
            meta.rows,
        );
        if std::env::var("AMA_DIFF").as_deref() == Ok(meta.slug.as_str()) {
            for (got, want) in f.text().lines().zip(want.text().lines()) {
                if got != want {
                    eprintln!("quickjs {got}\nnode    {want}");
                }
            }
        }
        let same = f
            .cells
            .iter()
            .zip(&want.cells)
            .filter(|(a, b)| a == b)
            .count();
        let share = same as f64 / want.cells.len() as f64;
        if share < 0.99 {
            bad.push(format!(
                "{}: {:.1}% of cells match",
                meta.slug,
                share * 100.0
            ));
        } else if share < 1.0 {
            eprintln!(
                "{}: {:.2}% of cells match (last-bit maths differences)",
                meta.slug,
                share * 100.0
            );
        }
    }
    times.sort_by(|a, b| b.cmp(a));
    eprintln!("slowest pieces in QuickJS (per frame, load):");
    for (d, l, s) in times.iter().take(12) {
        eprintln!(
            "  {s:32} {:7.1} ms  {:6.1} ms",
            d.as_secs_f64() * 1e3,
            l.as_secs_f64() * 1e3
        );
    }
    let total: f64 = times.iter().map(|t| t.0.as_secs_f64()).sum();
    eprintln!(
        "mean {:.2} ms per frame over {} pieces",
        total * 1e3 / times.len() as f64,
        times.len()
    );
    assert!(
        bad.is_empty(),
        "{} pieces differ from Node:\n{}",
        bad.len(),
        bad.join("\n")
    );
}
