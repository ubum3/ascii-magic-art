//! Intros and splash screens: a piece that fades in, holds, and fades out, with an
//! optional title card, skippable with a key.
//!
//! The quickest way, before your app starts (needs the `crossterm` feature, on by default):
//!
//! ```no_run
//! use ascii_magic_art_ratatui::{Intro, intro};
//! let mut terminal = ratatui::init();
//! intro::run(&mut terminal, Intro::from_slug("moonlit-sea")?.title("My App").subtitle("v1.0"))?;
//! // ... your app, on the same terminal
//! # ratatui::restore();
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! Or drive an [`IntroState`] from your own loop: render `&state`, call
//! [`skip`](IntroState::skip) on a key, and move on when [`is_done`](IntroState::is_done).

use std::time::{Duration, Instant};

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Modifier, Style};
use ratatui::widgets::Widget;

use crate::Error;
use crate::color::Rgb;
use crate::player::Player;
use crate::widget::{AsciiArt, Fit, detected};

/// How an intro is set up. Build one, then [`start`](Intro::start) it or pass it to [`run`].
#[derive(Debug)]
pub struct Intro {
    player: Player,
    title: Option<String>,
    subtitle: Option<String>,
    hint: Option<String>,
    fade_in: Duration,
    hold: Option<Duration>,
    fade_out: Duration,
    fit: Fit,
    bg: Rgb,
    accent: Rgb,
    ink: Rgb,
    skippable: bool,
    title_box: bool,
}

impl Intro {
    /// An intro over a player you made (any piece, yours included).
    pub fn new(player: Player) -> Intro {
        Intro {
            player,
            title: None,
            subtitle: None,
            hint: None,
            fade_in: Duration::from_millis(600),
            hold: Some(Duration::from_millis(2400)),
            fade_out: Duration::from_millis(600),
            fit: Fit::Cover,
            bg: Rgb(0, 0, 0),
            accent: Rgb(255, 255, 255),
            ink: Rgb(170, 170, 170),
            skippable: true,
            title_box: true,
        }
    }

    /// An intro over a library piece.
    pub fn from_slug(slug: &str) -> Result<Intro, Error> {
        Ok(Intro::new(Player::from_slug(slug)?))
    }

    pub fn title(mut self, s: impl Into<String>) -> Self {
        self.title = Some(s.into());
        self
    }

    pub fn subtitle(mut self, s: impl Into<String>) -> Self {
        self.subtitle = Some(s.into());
        self
    }

    /// A small line under the title, such as "press any key".
    pub fn hint(mut self, s: impl Into<String>) -> Self {
        self.hint = Some(s.into());
        self
    }

    pub fn fade_in(mut self, d: Duration) -> Self {
        self.fade_in = d;
        self
    }

    /// How long to stay at full strength. Default 2.4 s.
    pub fn hold(mut self, d: Duration) -> Self {
        self.hold = Some(d);
        self
    }

    /// Stay until a key is pressed (a "press any key" splash).
    pub fn until_key(mut self) -> Self {
        self.hold = None;
        self.skippable = true;
        self
    }

    pub fn fade_out(mut self, d: Duration) -> Self {
        self.fade_out = d;
        self
    }

    /// How the piece fills the screen. Default [`Fit::Cover`].
    pub fn fit(mut self, fit: Fit) -> Self {
        self.fit = fit;
        self
    }

    /// The colour the intro fades from and to. Default black.
    pub fn bg(mut self, bg: Rgb) -> Self {
        self.bg = bg;
        self
    }

    /// The title's colour. Default white.
    pub fn accent(mut self, c: Rgb) -> Self {
        self.accent = c;
        self
    }

    /// Whether a key skips ahead to the fade-out. Default true.
    pub fn skippable(mut self, on: bool) -> Self {
        self.skippable = on;
        self
    }

    /// Draw a rounded box behind the title. Default true.
    pub fn title_box(mut self, on: bool) -> Self {
        self.title_box = on;
        self
    }

    /// Start the clock.
    pub fn start(self) -> IntroState {
        IntroState {
            intro: self,
            start: Instant::now(),
            skipped: None,
        }
    }
}

/// A running intro. Render `&state` every frame.
#[derive(Debug)]
pub struct IntroState {
    intro: Intro,
    start: Instant,
    /// When it was skipped, and how strong it was then.
    skipped: Option<(Instant, f32)>,
}

impl IntroState {
    /// How visible the intro is at `now`: 0 is gone, 1 is full strength.
    pub fn alpha_at(&self, now: Instant) -> f32 {
        let i = &self.intro;
        if let Some((at, a0)) = self.skipped {
            let fo = i.fade_out.as_secs_f32() * a0;
            let d = now.saturating_duration_since(at).as_secs_f32();
            return if fo <= 0.0 {
                0.0
            } else {
                (a0 * (1.0 - d / fo)).max(0.0)
            };
        }
        let e = now.saturating_duration_since(self.start).as_secs_f32();
        let fi = i.fade_in.as_secs_f32();
        if e < fi {
            return e / fi;
        }
        let Some(hold) = i.hold else { return 1.0 };
        let e = e - fi - hold.as_secs_f32();
        let fo = i.fade_out.as_secs_f32();
        if e < 0.0 {
            1.0
        } else if e < fo {
            1.0 - e / fo
        } else {
            0.0
        }
    }

    /// True once it has faded out.
    pub fn is_done_at(&self, now: Instant) -> bool {
        let i = &self.intro;
        match (self.skipped, i.hold) {
            (Some(_), _) => self.alpha_at(now) <= 0.0,
            (None, Some(hold)) => {
                now.saturating_duration_since(self.start) >= i.fade_in + hold + i.fade_out
            }
            (None, None) => false,
        }
    }

    pub fn alpha(&self) -> f32 {
        self.alpha_at(Instant::now())
    }

    pub fn is_done(&self) -> bool {
        self.is_done_at(Instant::now())
    }

    /// Skip ahead: fade out from wherever it is. Does nothing if not skippable.
    pub fn skip(&mut self) {
        self.skip_at(Instant::now());
    }

    pub fn skip_at(&mut self, now: Instant) {
        if self.intro.skippable && self.skipped.is_none() {
            self.skipped = Some((now, self.alpha_at(now)));
        }
    }

    pub fn was_skipped(&self) -> bool {
        self.skipped.is_some()
    }

    pub fn player(&self) -> &Player {
        &self.intro.player
    }

    fn render_at(&self, now: Instant, area: Rect, buf: &mut Buffer) {
        let i = &self.intro;
        let a = self.alpha_at(now);
        AsciiArt::new(&i.player)
            .fit(i.fit)
            .bg(i.bg)
            .dim(1.0 - a)
            .render(area, buf);

        let lines: Vec<(&str, Rgb, bool)> = [
            i.title.as_deref().map(|s| (s, i.accent, true)),
            i.subtitle.as_deref().map(|s| (s, i.ink, false)),
            i.hint.as_deref().map(|s| (s, i.ink.mix(i.bg, 0.4), false)),
        ]
        .into_iter()
        .flatten()
        .collect();
        if lines.is_empty() {
            return;
        }
        let mode = detected();
        let fade = |c: Rgb| mode.color(c.mix(i.bg, 1.0 - a));
        let width = lines.iter().map(|l| l.0.chars().count()).max().unwrap_or(0) as u16;
        let pad = if i.title_box { 3 } else { 1 };
        let (bw, bh) = (
            (width + 2 * pad).min(area.width),
            (lines.len() as u16 + if i.title_box { 2 } else { 0 }).min(area.height),
        );
        let card = Rect {
            x: area.x + (area.width - bw) / 2,
            y: area.y + (area.height - bh) / 2,
            width: bw,
            height: bh,
        };
        let mut style = Style::new();
        if let Some(b) = mode.color(i.bg) {
            style = style.bg(b);
        }
        buf.set_style(card, style);
        for y in card.top()..card.bottom() {
            for x in card.left()..card.right() {
                buf[(x, y)].set_char(' ');
            }
        }
        if i.title_box && bw >= 2 && bh >= 2 {
            let border = style.fg(fade(i.accent.mix(i.bg, 0.5)).unwrap_or_default());
            let (l, r, t, b) = (card.left(), card.right() - 1, card.top(), card.bottom() - 1);
            for x in l + 1..r {
                buf[(x, t)].set_char('─').set_style(border);
                buf[(x, b)].set_char('─').set_style(border);
            }
            for y in t + 1..b {
                buf[(l, y)].set_char('│').set_style(border);
                buf[(r, y)].set_char('│').set_style(border);
            }
            for (x, y, ch) in [(l, t, '╭'), (r, t, '╮'), (l, b, '╰'), (r, b, '╯')] {
                buf[(x, y)].set_char(ch).set_style(border);
            }
        }
        let top = card.y + u16::from(i.title_box);
        for (n, (text, color, bold)) in lines.iter().enumerate() {
            let y = top + n as u16;
            if y >= card.bottom() {
                break;
            }
            let len = text.chars().count() as u16;
            let x = card.x + card.width.saturating_sub(len) / 2;
            let mut s = style;
            if let Some(c) = fade(*color) {
                s = s.fg(c);
            }
            if *bold {
                s = s.add_modifier(Modifier::BOLD);
            }
            buf.set_stringn(x, y, text, (card.right() - x) as usize, s);
        }
    }
}

impl Widget for &IntroState {
    fn render(self, area: Rect, buf: &mut Buffer) {
        self.render_at(Instant::now(), area, buf);
    }
}

/// How an intro ended.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Outcome {
    /// It played to the end.
    Finished,
    /// A key skipped it.
    Skipped,
    /// Ctrl-C, Esc or q: the user wants out of the app, not just the intro.
    Quit,
}

/// Play an intro on a terminal you've already set up, then return so your app can
/// draw on the same terminal. Any key skips; Ctrl-C, Esc and `q` return [`Outcome::Quit`].
#[cfg(feature = "crossterm")]
pub fn run(terminal: &mut ratatui::DefaultTerminal, intro: Intro) -> std::io::Result<Outcome> {
    use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
    intro.player.wait_ready(Duration::from_millis(500));
    let mut state = intro.start();
    loop {
        terminal.draw(|f| f.render_widget(&state, f.area()))?;
        if state.is_done() {
            return Ok(if state.was_skipped() {
                Outcome::Skipped
            } else {
                Outcome::Finished
            });
        }
        if event::poll(Duration::from_millis(16))?
            && let Event::Key(k) = event::read()?
        {
            if k.kind != KeyEventKind::Press {
                continue;
            }
            let ctrl_c =
                k.modifiers.contains(KeyModifiers::CONTROL) && k.code == KeyCode::Char('c');
            if ctrl_c || matches!(k.code, KeyCode::Esc | KeyCode::Char('q')) {
                return Ok(Outcome::Quit);
            }
            state.skip();
        }
    }
}

/// Play an intro, then go into your app with a [`Transition`](crate::Transition)
/// instead of a fade to black. `app` draws your app's screen; it is called every
/// frame while the transition plays, so your first screen can already move. When
/// this returns, carry on drawing your app as usual.
///
/// ```no_run
/// use std::time::Duration;
/// use ascii_magic_art_ratatui::{Intro, Transition, intro};
/// use ratatui::widgets::Paragraph;
/// let mut terminal = ratatui::init();
/// let splash = Intro::from_slug("moonlit-sea")?.title("My App");
/// let draw_app = |f: &mut ratatui::Frame| f.render_widget(Paragraph::new("hello"), f.area());
/// intro::run_into(&mut terminal, splash, Transition::Dissolve, Duration::from_millis(700), draw_app)?;
/// # ratatui::restore();
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
#[cfg(feature = "crossterm")]
pub fn run_into(
    terminal: &mut ratatui::DefaultTerminal,
    intro: Intro,
    transition: crate::Transition,
    duration: Duration,
    mut app: impl FnMut(&mut ratatui::Frame),
) -> std::io::Result<Outcome> {
    use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind, KeyModifiers};
    let intro = intro.fade_out(Duration::ZERO);
    intro.player.wait_ready(Duration::from_millis(500));
    let mut state = intro.start();
    let mut last = Buffer::empty(terminal.get_frame().area());
    let outcome = loop {
        if state.is_done() {
            break if state.was_skipped() {
                Outcome::Skipped
            } else {
                Outcome::Finished
            };
        }
        last = terminal
            .draw(|f| f.render_widget(&state, f.area()))?
            .buffer
            .clone();
        if event::poll(Duration::from_millis(16))?
            && let Event::Key(k) = event::read()?
        {
            if k.kind != KeyEventKind::Press {
                continue;
            }
            let ctrl_c =
                k.modifiers.contains(KeyModifiers::CONTROL) && k.code == KeyCode::Char('c');
            if ctrl_c || matches!(k.code, KeyCode::Esc | KeyCode::Char('q')) {
                return Ok(Outcome::Quit);
            }
            state.skip();
        }
    };
    drop(state);
    crate::transition::run(
        terminal,
        transition,
        duration,
        |f| f.buffer_mut().merge(&last),
        &mut app,
    )?;
    Ok(outcome)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn intro() -> IntroState {
        let p = crate::Player::new(crate::piece_test::Stripes::new());
        Intro::new(p)
            .fade_in(Duration::from_secs(1))
            .hold(Duration::from_secs(2))
            .fade_out(Duration::from_secs(1))
            .start()
    }

    #[test]
    fn timeline() {
        let s = intro();
        let at = |ms: u64| s.start + Duration::from_millis(ms);
        assert_eq!(s.alpha_at(at(0)), 0.0);
        assert!((s.alpha_at(at(500)) - 0.5).abs() < 1e-3);
        assert_eq!(s.alpha_at(at(2000)), 1.0);
        assert!((s.alpha_at(at(3500)) - 0.5).abs() < 1e-3);
        assert!(!s.is_done_at(at(3900)));
        assert!(s.is_done_at(at(4000)));
    }

    #[test]
    fn skip_fades_from_where_it_is() {
        let mut s = intro();
        let t = s.start + Duration::from_millis(500);
        s.skip_at(t);
        assert!((s.alpha_at(t) - 0.5).abs() < 1e-3);
        assert!(s.is_done_at(t + Duration::from_millis(500)));
        assert!(!s.is_done_at(t + Duration::from_millis(400)));
    }

    #[test]
    fn title_card_renders() {
        let mut s = intro();
        s.intro.title = Some("Hello".into());
        let area = Rect::new(0, 0, 30, 9);
        let mut buf = Buffer::empty(area);
        s.render_at(s.start + Duration::from_secs(2), area, &mut buf);
        let row: String = (0..30)
            .map(|x| buf[(x, 4)].symbol().chars().next().unwrap())
            .collect();
        assert!(row.contains("│  Hello  │"), "{row:?}");
        assert!(buf[(12, 4)].modifier.contains(Modifier::BOLD));
    }
}
