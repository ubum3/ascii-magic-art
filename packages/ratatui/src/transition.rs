//! Transitions between two screens: wipe, dissolve, melt, scramble and iris. They
//! work on rendered cells, so they go between anything: two pieces, an intro and
//! your app, two views of your app.
//!
//! ```no_run
//! # use ratatui::buffer::Buffer;
//! # use ratatui::layout::Rect;
//! use ascii_magic_art_ratatui::{Transition, transition::TransitionView};
//! # let (from, to) = (Buffer::empty(Rect::new(0, 0, 80, 24)), Buffer::empty(Rect::new(0, 0, 80, 24)));
//! # let mut terminal = ratatui::init();
//! let view = TransitionView::new(&from, &to, Transition::Dissolve, 0.5);
//! terminal.draw(|f| f.render_widget(view, f.area()))?;
//! # ratatui::restore();
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! With the `crossterm` feature, [`run`] plays one on a terminal, and
//! [`intro::run_into`](crate::intro::run_into) ends an intro with one into your app.

use ratatui::buffer::{Buffer, Cell};
use ratatui::layout::Rect;
use ratatui::widgets::Widget;

/// Which way a wipe goes.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Direction {
    Left,
    Right,
    Up,
    Down,
}

/// How one screen turns into another.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Transition {
    /// The new screen slides in from one side, behind a bright edge.
    Wipe(Direction),
    /// Cells switch over one by one, in a scattered order.
    Dissolve,
    /// The old screen's columns drip down and away.
    Melt,
    /// Cells flicker through random glyphs before they settle.
    Scramble,
    /// A circle opens from the centre.
    Iris,
}

fn hash(x: u32, y: u32, n: u32) -> f64 {
    let mut h = (x.wrapping_mul(374_761_393))
        .wrapping_add(y.wrapping_mul(668_265_263))
        .wrapping_add(n.wrapping_mul(2_147_483_647));
    h = (h ^ (h >> 13)).wrapping_mul(1_274_126_177);
    (h ^ (h >> 16)) as f64 / 4_294_967_296.0
}

const NOISE: &[char] = &[
    '!', '<', '>', '-', '_', '/', '[', ']', '{', '}', '=', '+', '*', '^', '?', '#', '%', '&', '$',
    '@',
];

fn smooth(t: f64) -> f64 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

impl Transition {
    /// Every transition, for cycling through them.
    pub const ALL: [Transition; 8] = [
        Transition::Dissolve,
        Transition::Wipe(Direction::Right),
        Transition::Wipe(Direction::Left),
        Transition::Wipe(Direction::Down),
        Transition::Wipe(Direction::Up),
        Transition::Melt,
        Transition::Scramble,
        Transition::Iris,
    ];

    /// The cell at `(x, y)` (relative to the area) at `p` (0 is all `from`, 1 all `to`).
    pub fn cell<'a>(self, from: &'a Buffer, to: &'a Buffer, x: u16, y: u16, p: f64) -> Cell {
        let (fa, ta) = (from.area, to.area);
        let at = |b: &Buffer, a: Rect, x: u16, y: u16| -> Cell {
            if x < a.width && y < a.height {
                b[(a.x + x, a.y + y)].clone()
            } else {
                Cell::default()
            }
        };
        let (w, h) = (
            fa.width.max(ta.width) as f64,
            fa.height.max(ta.height) as f64,
        );
        let (fx, fy) = (x as f64 + 0.5, y as f64 + 0.5);
        if p <= 0.0 {
            return at(from, fa, x, y);
        }
        if p >= 1.0 {
            return at(to, ta, x, y);
        }
        match self {
            Transition::Wipe(d) => {
                let (u, len) = match d {
                    Direction::Right => (fx, w),
                    Direction::Left => (w - fx, w),
                    Direction::Down => (fy, h),
                    Direction::Up => (h - fy, h),
                };
                let front = smooth(p) * (len + 2.0) - 1.0;
                if u < front - 1.0 {
                    at(to, ta, x, y)
                } else if u < front {
                    let mut c = at(to, ta, x, y);
                    c.set_char('█');
                    c
                } else {
                    at(from, fa, x, y)
                }
            }
            Transition::Dissolve => {
                if hash(x as u32, y as u32, 7) < smooth(p) {
                    at(to, ta, x, y)
                } else {
                    at(from, fa, x, y)
                }
            }
            Transition::Scramble => {
                let k = hash(x as u32, y as u32, 3);
                let q = smooth(p) * 1.3;
                if k < q - 0.3 {
                    at(to, ta, x, y)
                } else if k < q {
                    let mut c = at(to, ta, x, y);
                    let n = (p * 30.0) as u32;
                    c.set_char(
                        NOISE[(hash(x as u32, y as u32, n) * NOISE.len() as f64) as usize
                            % NOISE.len()],
                    );
                    c
                } else {
                    at(from, fa, x, y)
                }
            }
            Transition::Melt => {
                let delay = hash(x as u32, 0, 11) * 0.35;
                let k = ((p - delay) / 0.65).clamp(0.0, 1.0);
                let drop = (k * k * (h + 2.0)).floor() as i64;
                let sy = y as i64 - drop;
                if sy >= 0 {
                    at(from, fa, x, sy as u16)
                } else {
                    at(to, ta, x, y)
                }
            }
            Transition::Iris => {
                let (dx, dy) = (fx - w / 2.0, (fy - h / 2.0) / 0.602);
                let r = smooth(p) * ((w / 2.0).hypot(h / 2.0 / 0.602) + 1.0);
                if dx.hypot(dy) < r {
                    at(to, ta, x, y)
                } else {
                    at(from, fa, x, y)
                }
            }
        }
    }

    /// Mix `from` into `to` at `p` (0..1), into `out` over `area`.
    pub fn blend(self, from: &Buffer, to: &Buffer, p: f64, area: Rect, out: &mut Buffer) {
        let area = area.intersection(out.area);
        for y in 0..area.height {
            for x in 0..area.width {
                out[(area.x + x, area.y + y)] = self.cell(from, to, x, y, p);
            }
        }
    }
}

/// A widget showing a transition at one moment.
#[derive(Clone, Copy, Debug)]
pub struct TransitionView<'a> {
    from: &'a Buffer,
    to: &'a Buffer,
    kind: Transition,
    progress: f64,
}

impl<'a> TransitionView<'a> {
    pub fn new(from: &'a Buffer, to: &'a Buffer, kind: Transition, progress: f64) -> Self {
        TransitionView {
            from,
            to,
            kind,
            progress,
        }
    }
}

impl Widget for TransitionView<'_> {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.kind
            .blend(self.from, self.to, self.progress, area, buf);
    }
}

/// Play a transition on a terminal, from one screen to another. Both closures draw
/// every frame (into offscreen buffers the size of the terminal), so animated
/// screens keep moving while it plays.
#[cfg(feature = "crossterm")]
pub fn run(
    terminal: &mut ratatui::DefaultTerminal,
    kind: Transition,
    duration: std::time::Duration,
    mut from: impl FnMut(&mut ratatui::Frame),
    mut to: impl FnMut(&mut ratatui::Frame),
) -> std::io::Result<()> {
    use ratatui::{Terminal, backend::TestBackend};
    let size = terminal.size()?;
    let mut a =
        Terminal::new(TestBackend::new(size.width, size.height)).expect("offscreen terminal");
    let mut b =
        Terminal::new(TestBackend::new(size.width, size.height)).expect("offscreen terminal");
    let start = std::time::Instant::now();
    loop {
        let p = start.elapsed().as_secs_f64() / duration.as_secs_f64().max(1e-3);
        a.draw(|f| from(f)).expect("offscreen draw");
        b.draw(|f| to(f)).expect("offscreen draw");
        let (fb, tb) = (a.backend().buffer(), b.backend().buffer());
        terminal.draw(|f| {
            let area = f.area();
            f.render_widget(TransitionView::new(fb, tb, kind, p.min(1.0)), area);
        })?;
        if p >= 1.0 {
            return Ok(());
        }
        std::thread::sleep(std::time::Duration::from_millis(16));
    }
}
