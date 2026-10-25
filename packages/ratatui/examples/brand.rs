//! A logo intro that dissolves into a small dashboard drawn with extras: a progress
//! bar, a sparkline and a ticker fed live. `c` celebrates, `t` replays the intro with
//! the next transition, `q` quits.
//!
//!     cargo run --release --example brand [logo.json]
//!
//! Make your own logo spec with `npx ama-studio brand logo.svg --effect assemble -o logo.json`.

use std::time::{Duration, Instant};

use ascii_magic_art_ratatui::{AsciiArt, Celebration, Fit, Intro, Player, Spec, Transition, intro};
use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::Stylize;
use ratatui::widgets::{Block, BorderType, Clear, Paragraph};

struct Dash {
    progress: Player,
    spark: Player,
    ticker: Player,
    party: Option<(Player, Instant)>,
    values: Vec<f64>,
    start: Instant,
}

impl Dash {
    fn new() -> Result<Dash, ascii_magic_art_ratatui::Error> {
        Ok(Dash {
            progress: Spec::progress(44).set("label", "Settling batch").player()?,
            spark: Spec::sparkline(44, 6).set("label", "Payments / min").player()?,
            ticker: Spec::ticker(96).player()?,
            party: None,
            values: Vec::new(),
            start: Instant::now(),
        })
    }

    /// New data, about ten times a second.
    fn feed(&mut self) {
        let t = self.start.elapsed().as_secs_f64();
        let v = 60.0 + (t * 0.7).sin() * 25.0 + (t * 2.3).sin() * 8.0;
        if self.values.len() as f64 * 0.25 < t {
            self.values.push(v.round());
        }
        let value = (t / 12.0).fract();
        self.progress.set_state(format!(r#"{{"value": {value:.3}, "label": "Settling batch {}"}}"#, 1 + (t / 12.0) as u32));
        self.spark.set_state(format!(r#"{{"values": {:?}, "label": "Payments / min"}}"#, self.values));
        self.ticker.set_state(format!(
            r#"{{"items": [{{"label": "VOLUME", "value": {}, "delta": {:.1}}}, {{"label": "AUTH RATE", "value": 98.{}, "delta": -0.2}}, {{"label": "PAYOUTS", "value": {}, "delta": 3.4}}]}}"#,
            (1_200_000.0 + t * 1500.0) as u64,
            (t * 0.4).sin() * 3.0,
            (t as u64) % 10,
            420 + (t as u64) / 3
        ));
        if self.party.as_ref().is_some_and(|(_, at)| at.elapsed() > Duration::from_secs(3)) {
            self.party = None;
        }
    }

    fn draw(&self, f: &mut ratatui::Frame) {
        let area = f.area();
        let panel = |title: &'static str| Block::bordered().border_type(BorderType::Rounded).title(title.bold());
        let [head, mid, foot] = Layout::vertical([Constraint::Length(3), Constraint::Length(10), Constraint::Length(3)])
            .flex(ratatui::layout::Flex::Center)
            .areas(area);
        let [left, right] = Layout::horizontal([Constraint::Length(48), Constraint::Length(48)])
            .flex(ratatui::layout::Flex::Center)
            .areas(mid);
        f.render_widget(Paragraph::new("  Payments console · c celebrate · t next transition · q quit").dim(), head);
        let inner = |b: &Block, r: Rect| b.inner(r);
        let b = panel(" batch ");
        f.render_widget(&b, left);
        f.render_widget(AsciiArt::new(&self.progress), inner(&b, left));
        let b = panel(" throughput ");
        f.render_widget(&b, right);
        f.render_widget(AsciiArt::new(&self.spark), inner(&b, right));
        let b = panel(" live ");
        f.render_widget(&b, foot);
        f.render_widget(AsciiArt::new(&self.ticker).fit(Fit::Center), inner(&b, foot));
        if let Some((p, _)) = &self.party {
            let r = Rect::new(area.width.saturating_sub(42) / 2, area.height.saturating_sub(14) / 2, 42.min(area.width), 14.min(area.height));
            f.render_widget(Clear, r);
            let b = panel("");
            f.render_widget(&b, r);
            f.render_widget(AsciiArt::new(p), b.inner(r));
        }
    }
}

fn logo() -> Result<Player, ascii_magic_art_ratatui::Error> {
    let json = match std::env::args().nth(1) {
        Some(path) => std::fs::read_to_string(&path).unwrap_or_else(|e| {
            eprintln!("{path}: {e}");
            std::process::exit(1)
        }),
        None => include_str!("assets/mark.json").to_string(),
    };
    Player::from_spec(json)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut dash = Dash::new()?;
    let mut which = 0;
    let result = ratatui::run(|terminal| -> std::io::Result<()> {
        loop {
            let splash = Intro::new(logo().map_err(std::io::Error::other)?)
                .fit(Fit::Center)
                .fade_in(Duration::from_millis(150))
                .hold(Duration::from_millis(3200))
                .hint("press any key");
            let kind = Transition::ALL[which % Transition::ALL.len()];
            if intro::run_into(terminal, splash, kind, Duration::from_millis(900), |f| {
                dash.feed();
                dash.draw(f)
            })? == intro::Outcome::Quit
            {
                return Ok(());
            }
            loop {
                dash.feed();
                terminal.draw(|f| dash.draw(f))?;
                if event::poll(Duration::from_millis(33))?
                    && let Event::Key(k) = event::read()?
                    && k.kind == KeyEventKind::Press
                {
                    match k.code {
                        KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                        KeyCode::Char('c') => {
                            let p = Spec::celebrate("Payment approved", Celebration::Check).set("cols", 40).set("rows", 12).player();
                            dash.party = p.ok().map(|p| (p, Instant::now()));
                        }
                        KeyCode::Char('t') => {
                            which += 1;
                            break;
                        }
                        _ => {}
                    }
                }
            }
        }
    });
    result?;
    Ok(())
}
