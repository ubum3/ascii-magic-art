//! The extras: every fixture spec drawn in QuickJS against the frame Node drew
//! (`packages/fixtures/extras-golden.bin`, from `npm run native`), plus clips,
//! transitions, casts and the spec builders.

use std::collections::BTreeMap;
use std::io::{Read, Write};

use ascii_magic_art_ratatui::{
    AsciiArt, Celebration, Clip, Frame, JsPiece, Piece, Player, Spec, TextEffect, Transition, cast,
    transition::Direction,
};
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::widgets::Widget;
use serde_json::Value;

fn golden() -> Option<BTreeMap<String, Value>> {
    let path = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures/extras-golden.bin");
    let raw = std::fs::read(path).ok()?;
    let mut s = String::new();
    flate2::read::DeflateDecoder::new(&raw[..])
        .read_to_string(&mut s)
        .ok()?;
    serde_json::from_str(&s).ok()
}

#[test]
fn every_fixture_matches_node() {
    let Some(golden) = golden() else {
        eprintln!("no packages/fixtures/extras-golden.bin (outside the repo?): skipped");
        return;
    };
    assert!(golden.len() > 20);
    let mut bad = Vec::new();
    for (name, g) in &golden {
        let mut p =
            JsPiece::from_spec(&g["spec"].to_string()).unwrap_or_else(|e| panic!("{name}: {e}"));
        if !g["state"].is_null() {
            p.try_set_state(&g["state"].to_string()).unwrap();
        }
        let mut f = Frame::blank(0, 0);
        for t in g["times"].as_array().unwrap() {
            f = p
                .try_draw(t.as_f64().unwrap())
                .unwrap_or_else(|e| panic!("{name}: {e}"));
        }
        let m = p.meta();
        let (text, color) = (
            g["frame"][0].as_str().unwrap(),
            g["frame"][1].as_str().unwrap(),
        );
        let want = Frame::from_layers(
            text,
            (!color.is_empty()).then_some(color),
            &m.palette,
            m.cols,
            m.rows,
        );
        let same = want
            .cells
            .iter()
            .zip(&f.cells)
            .filter(|(a, b)| a == b)
            .count();
        let share = same as f64 / want.cells.len() as f64;
        if share < 0.99 {
            bad.push(format!("{name}: {:.1}% of cells match", share * 100.0));
        }
    }
    assert!(bad.is_empty(), "{}", bad.join("\n"));
}

#[test]
fn players_take_specs_and_state() {
    let p = Spec::progress(20).set("label", "Up").player().unwrap();
    assert_eq!((p.meta().cols, p.meta().rows), (20, 2));
    assert!(
        p.wait_ready(std::time::Duration::from_secs(5)),
        "{:?}",
        p.error()
    );
    p.set_state(r#"{"value": 1}"#);
    let mut done = false;
    for _ in 0..100 {
        std::thread::sleep(std::time::Duration::from_millis(20));
        if p.frame().text().contains("✓ done") {
            done = true;
            break;
        }
    }
    assert!(done, "{}", p.frame().text());
    assert!(matches!(
        Player::from_spec(r#"{"kind":"nope"}"#),
        Err(ascii_magic_art_ratatui::Error::Js { .. })
    ));
    let t = Spec::text("HI").effect(TextEffect::Plain);
    assert_eq!(t.get("effect").unwrap(), "plain");
    let mut c = JsPiece::from_spec(&Spec::celebrate("ok", Celebration::Check).to_json()).unwrap();
    assert!(c.try_draw(2.0).unwrap().text().contains("ok"));
}

#[test]
fn pictures_from_pixels() {
    let mut px = Vec::new();
    for y in 0..8u8 {
        for x in 0..16u8 {
            px.extend([x * 16, y * 32, 200, 255]);
        }
    }
    let spec = Spec::image_rgba(&px, 16, 8, true).unwrap();
    assert_eq!(spec.get("cols").unwrap(), 16);
    let mut p = JsPiece::from_spec(&spec.to_json()).unwrap();
    assert!(p.meta().square);
    let f = p.try_draw(0.0).unwrap();
    assert_eq!((f.cols, f.rows), (16, 8));
    assert!(f.cells.iter().all(|c| c.fg.is_some()));
    assert!(ascii_magic_art_ratatui::image_spec_from_rgba(&px, 3, 3, "{}").is_err());
}

fn clip_bytes() -> Vec<u8> {
    let head = br##"{"version":1,"cols":2,"rows":1,"fps":2,"frames":2,"square":false,"loop":true,"palette":{"0":"#ff0000"}}"##;
    let mut z = flate2::write::DeflateEncoder::new(Vec::new(), flate2::Compression::default());
    // frame 1: "ab" with "0 " colours; frame 2: "xy", plain
    z.write_all("ab\u{0}0 \u{0}xy\u{0}\u{0}".as_bytes())
        .unwrap();
    let body = z.finish().unwrap();
    let mut out = b"AMC1".to_vec();
    out.extend((head.len() as u32).to_le_bytes());
    out.extend(head);
    out.extend(body);
    out
}

#[test]
fn clips_play_and_loop() {
    let mut c = Clip::from_bytes(&clip_bytes()).unwrap();
    assert_eq!(c.frames().len(), 2);
    assert_eq!(c.duration(), 1.0);
    let f = c.draw(0.0);
    assert_eq!(f.text(), "ab");
    assert_eq!(
        f.get(0, 0).fg,
        Some(ascii_magic_art_ratatui::Rgb(255, 0, 0))
    );
    assert_eq!(c.draw(0.5).text(), "xy");
    assert_eq!(c.draw(1.0).text(), "ab");
    assert!(Clip::from_bytes(b"nope").is_err());
    let p = Player::new(c);
    assert!(p.wait_ready(std::time::Duration::from_secs(2)));
}

fn filled(ch: &str) -> Buffer {
    let mut b = Buffer::empty(Rect::new(0, 0, 10, 4));
    for y in 0..4 {
        for x in 0..10 {
            b[(x, y)].set_symbol(ch);
        }
    }
    b
}

fn count(b: &Buffer, ch: &str) -> usize {
    b.content().iter().filter(|c| c.symbol() == ch).count()
}

#[test]
fn transitions_go_from_one_to_the_other() {
    let (a, z) = (filled("a"), filled("z"));
    for kind in Transition::ALL {
        let mut out = Buffer::empty(a.area);
        kind.blend(&a, &z, 0.0, a.area, &mut out);
        assert_eq!(count(&out, "a"), 40, "{kind:?} at 0");
        kind.blend(&a, &z, 1.0, a.area, &mut out);
        assert_eq!(count(&out, "z"), 40, "{kind:?} at 1");
        kind.blend(&a, &z, 0.5, a.area, &mut out);
        assert!(count(&out, "a") < 40, "{kind:?} at 0.5 has started");
    }
    let mut out = Buffer::empty(a.area);
    Transition::Wipe(Direction::Right).blend(&a, &z, 0.5, a.area, &mut out);
    assert_eq!(out[(0, 0)].symbol(), "z");
    assert_eq!(out[(9, 0)].symbol(), "a");
}

#[test]
fn casts_are_asciicast_v2() {
    let mut piece =
        JsPiece::from_spec(&Spec::text("OK").effect(TextEffect::Typewriter).to_json()).unwrap();
    let out = cast::record(&mut piece, 1.0, 10.0, Vec::new()).unwrap();
    let s = String::from_utf8(out).unwrap();
    let lines: Vec<Value> = s
        .lines()
        .map(|l| serde_json::from_str(l).unwrap())
        .collect();
    assert_eq!(lines[0]["version"], 2);
    assert_eq!(lines[0]["width"], piece.meta().cols);
    assert!(lines.len() > 3);
    let first = lines[2][2].as_str().unwrap();
    assert!(first.starts_with("\x1b[H"));
    assert!(first.contains("\x1b[38;2;"), "24-bit colour");
    let mut buf = Buffer::empty(Rect::new(0, 0, 4, 1));
    AsciiArt::new(&Frame::blank(4, 1)).render(buf.area, &mut buf);
    assert_eq!(cast::ansi(&buf).matches(' ').count(), 4);
}
