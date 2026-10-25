//! A splash screen, then the app. Any key skips the intro; `q` quits.
//!
//!     cargo run --release --example intro [slug]

use std::time::Duration;

use ascii_magic_art_ratatui::intro::{self, Outcome};
use ascii_magic_art_ratatui::{Intro, Rgb, slug};
use ratatui::crossterm::event::{self, Event, KeyCode};
use ratatui::layout::Alignment;
use ratatui::widgets::{Block, Paragraph};

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let name = std::env::args()
        .nth(1)
        .unwrap_or_else(|| slug::MOONLIT_SEA.to_string());
    let splash = Intro::from_slug(&name)?
        .title("ACME CLI")
        .subtitle("v2.4.0 · the friendly deploy tool")
        .hint("press any key")
        .accent(Rgb(0xff, 0xd8, 0x6b));
    ratatui::run(|terminal| {
        if intro::run(terminal, splash)? == Outcome::Quit {
            return Ok(());
        }
        loop {
            terminal.draw(|f| {
                let text = "\n\nThis is your app.\n\nThe intro faded out and handed the terminal over.\n\nPress q to quit.";
                f.render_widget(Paragraph::new(text).alignment(Alignment::Center).block(Block::bordered().title(" app ")), f.area());
            })?;
            if event::poll(Duration::from_millis(250))?
                && let Event::Key(k) = event::read()?
                && matches!(k.code, KeyCode::Char('q') | KeyCode::Esc)
            {
                return Ok(());
            }
        }
    })
}
