//! A dashboard over a dimmed, full-screen piece. `q` quits.
//!
//!     cargo run --release --example background [slug]

use std::time::Duration;

use ascii_magic_art_ratatui::{AsciiArt, Player, slug};
use ratatui::crossterm::event::{self, Event, KeyCode};
use ratatui::layout::{Constraint, Layout, Margin};
use ratatui::style::{Color, Style, Stylize};
use ratatui::widgets::{Block, BorderType, Clear, Gauge, List, Paragraph, Sparkline};

fn main() -> std::io::Result<()> {
    let name = std::env::args()
        .nth(1)
        .unwrap_or_else(|| slug::SYNTHWAVE_GRID.to_string());
    let player = match Player::from_slug(&name) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(1);
        }
    };
    let panel = |title: &'static str| {
        Block::bordered()
            .border_type(BorderType::Rounded)
            .title(title.bold())
            .bg(Color::Black)
    };
    let mut tick = 0u64;
    ratatui::run(|terminal| {
        loop {
            tick += 1;
            terminal.draw(|f| {
                // The art first, then the panels on top of it.
                f.render_widget(AsciiArt::background(&player).dim(0.6), f.area());
                let area = f.area().inner(Margin::new(4, 2));
                let [top, bottom] =
                    Layout::vertical([Constraint::Length(7), Constraint::Length(10)]).areas(area);
                let [left, right] =
                    Layout::horizontal([Constraint::Percentage(40), Constraint::Percentage(60)])
                        .areas(bottom);
                let data: Vec<u64> = (0..120)
                    .map(|x| (((x + tick / 2) as f64 * 0.21).sin() * 40.0 + 50.0) as u64)
                    .collect();
                for rect in [top, left, right] {
                    f.render_widget(Clear, rect);
                }
                f.render_widget(
                    Paragraph::new(format!(
                        "\n  Welcome back.\n  Background: {} ({} fps)",
                        player.meta().name,
                        player.meta().fps
                    ))
                    .block(panel(" status ")),
                    top,
                );
                f.render_widget(
                    List::new([
                        "deploy api       ✓",
                        "migrate db       ✓",
                        "warm caches      …",
                        "notify team",
                    ])
                    .block(panel(" jobs ")),
                    left,
                );
                let [spark, gauge] =
                    Layout::vertical([Constraint::Fill(1), Constraint::Length(3)]).areas(right);
                f.render_widget(
                    Sparkline::default()
                        .data(&data)
                        .style(Style::new().cyan())
                        .block(panel(" traffic ")),
                    spark,
                );
                f.render_widget(
                    Gauge::default()
                        .ratio((tick % 300) as f64 / 300.0)
                        .gauge_style(Style::new().magenta())
                        .block(panel(" build ")),
                    gauge,
                );
            })?;
            if event::poll(Duration::from_millis(33))?
                && let Event::Key(k) = event::read()?
                && matches!(k.code, KeyCode::Char('q') | KeyCode::Esc)
            {
                return Ok(());
            }
        }
    })
}
