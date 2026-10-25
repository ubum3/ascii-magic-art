use ascii_magic_art_ratatui::*;
use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::Color;
use ratatui::widgets::Widget;

/// A 4x2 frame: "abcd" / "efgh", the first cell red.
fn frame() -> Frame {
    Frame::from_layers(
        "abcd\nefgh",
        Some("0   \n    "),
        &Palette::from_hexes(&["#ff0000"]),
        4,
        2,
    )
}

fn render(art: AsciiArt, w: u16, h: u16) -> Buffer {
    let mut buf = Buffer::empty(Rect::new(0, 0, w, h));
    art.color_mode(ColorMode::TrueColor)
        .render(buf.area, &mut buf);
    buf
}

fn rows(buf: &Buffer) -> Vec<String> {
    (0..buf.area.height)
        .map(|y| {
            (0..buf.area.width)
                .map(|x| buf[(x, y)].symbol().to_string())
                .collect()
        })
        .collect()
}

#[test]
fn center_places_and_crops() {
    let f = frame();
    assert_eq!(
        rows(&render(AsciiArt::new(&f), 8, 4)),
        ["        ", "  abcd  ", "  efgh  ", "        "]
    );
    assert_eq!(rows(&render(AsciiArt::new(&f), 2, 1)), ["bc"]);
    assert_eq!(
        rows(&render(AsciiArt::new(&f).align(Align::TopLeft), 6, 3)),
        ["abcd  ", "efgh  ", "      "]
    );
}

#[test]
fn cover_contain_stretch_tile() {
    let f = frame();
    // Cover: scaled x2 to fill 8x4 exactly.
    assert_eq!(
        rows(&render(AsciiArt::new(&f).fit(Fit::Cover), 8, 4)),
        ["aabbccdd", "aabbccdd", "eeffgghh", "eeffgghh"]
    );
    // Cover on a wide area: scaled x3, rows cropped.
    assert_eq!(
        rows(&render(AsciiArt::new(&f).fit(Fit::Cover), 12, 2))[0],
        "aaabbbcccddd"
    );
    // Contain: x1 inside 12x2, centred.
    assert_eq!(
        rows(&render(AsciiArt::new(&f).fit(Fit::Contain), 12, 2)),
        ["    abcd    ", "    efgh    "]
    );
    assert_eq!(
        rows(&render(AsciiArt::new(&f).fit(Fit::Stretch), 8, 2)),
        ["aabbccdd", "eeffgghh"]
    );
    assert_eq!(
        rows(&render(AsciiArt::new(&f).fit(Fit::Tile), 6, 3)),
        ["abcdab", "efghef", "abcdab"]
    );
}

#[test]
fn colours_dim_and_mono() {
    let f = frame();
    let b = render(AsciiArt::new(&f).align(Align::TopLeft), 4, 2);
    assert_eq!(b[(0, 0)].fg, Color::Rgb(255, 0, 0));
    assert_eq!(
        b[(1, 0)].fg,
        Color::Reset,
        "uncoloured cells keep the default ink"
    );
    let b = render(AsciiArt::new(&f).align(Align::TopLeft).dim(0.5), 4, 2);
    assert_eq!(b[(0, 0)].fg, Color::Rgb(128, 0, 0));
    assert_eq!(
        b[(1, 0)].fg,
        Color::Rgb(102, 102, 102),
        "dimmed default ink"
    );
    let b = render(
        AsciiArt::new(&f).align(Align::TopLeft).mono(Rgb(0, 255, 0)),
        4,
        2,
    );
    assert_eq!(b[(3, 1)].fg, Color::Rgb(0, 255, 0));
    let mut b = Buffer::empty(Rect::new(0, 0, 4, 2));
    AsciiArt::new(&f)
        .color_mode(ColorMode::Ansi256)
        .render(b.area, &mut b);
    assert_eq!(b[(0, 0)].fg, Color::Indexed(196));
}

#[test]
fn bg_fills_and_transparent_skips_blanks() {
    let f = Frame::from_layers("a  b", None, &Palette::new(), 4, 1);
    let b = render(AsciiArt::new(&f).bg(Rgb(1, 2, 3)), 6, 1);
    assert!((0..6).all(|x| b[(x, 0)].bg == Color::Rgb(1, 2, 3)));
    let mut buf = Buffer::with_lines(["xxxx"]);
    AsciiArt::new(&f)
        .transparent(true)
        .render(buf.area, &mut buf);
    assert_eq!(rows(&buf), ["axxb"]);
}

#[test]
fn square_pieces_draw_half_blocks() {
    let pal = Palette::from_hexes(&["#ff0000", "#0000ff"]);
    let mut f = Frame::from_layers("██\n▄▄", Some("00\n11"), &pal, 2, 2);
    f.square = true;
    let b = render(AsciiArt::new(&f), 2, 1);
    assert_eq!(rows(&b), ["▀▀"]);
    assert_eq!(b[(0, 0)].fg, Color::Rgb(255, 0, 0));
    assert_eq!(b[(0, 0)].bg, Color::Rgb(0, 0, 163), "▄ is 51% ink, x1.25");
}

#[test]
fn a_library_piece_renders_through_a_player() {
    let p = Player::from_slug(slug::SPINNING_TORUS).unwrap();
    assert!(p.wait_ready(std::time::Duration::from_secs(5)));
    let b = render(AsciiArt::background(&p), 96, 24);
    let ink = rows(&b).concat().chars().filter(|c| *c != ' ').count();
    assert!(ink > 200, "torus drawn ({ink} cells)");
}

#[test]
fn custom_piece_with_grid() {
    struct Badge(Meta, Grid);
    impl Piece for Badge {
        fn meta(&self) -> &Meta {
            &self.0
        }
        fn draw(&mut self, t: f64) -> Frame {
            let g = &mut self.1;
            g.clear();
            g.draw_box(0, 0, 12, 3, BoxStyle::Round, Some('1'));
            g.text(2, 1, &format!("build #{}", t as u32), Some('0'));
            g.frame(&self.0.palette)
        }
    }
    let meta = Meta::new("badge", 12, 3).palette(Palette::from_hexes(&["#7ee787", "#8b949e"]));
    let mut badge = Badge(meta, Grid::new(12, 3));
    let f = badge.draw(7.2);
    assert_eq!(f.text(), "╭──────────╮\n│ build #7 │\n╰──────────╯");
    assert_eq!(f.get(2, 1).fg, Some(Rgb(0x7e, 0xe7, 0x87)));
    assert!(SLUGS.len() > 600 && SLUGS.contains(&slug::MATRIX_RAIN));
}
