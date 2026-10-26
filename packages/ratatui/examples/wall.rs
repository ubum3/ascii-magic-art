//! The payments wall in a terminal: the layout from `ama-wall` (packages/wall),
//! sized to this terminal, with its state streamed over SSE. One player, one
//! `set_state` per update. `q` quits.
//!
//!     npx ama-wall                  # in another terminal: mock payments on :8787
//!     cargo run --release --example wall [http://127.0.0.1:8787]
//!
//! Plain HTTP/1.0 over a TcpStream, so the example needs no HTTP crate.

use std::io::{BufRead, BufReader, Read, Write};
use std::net::TcpStream;
use std::sync::mpsc;
use std::time::Duration;

use ascii_magic_art_ratatui::{AsciiArt, Fit, Player};
use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::style::Stylize;
use ratatui::widgets::Paragraph;

/// host:port and path of an http:// URL.
fn split(url: &str) -> (String, String) {
    let rest = url.strip_prefix("http://").unwrap_or(url);
    match rest.find('/') {
        Some(i) => (rest[..i].to_string(), rest[i..].to_string()),
        None => (rest.to_string(), "/".to_string()),
    }
}

/// A GET with the headers read; the reader is at the body. HTTP/1.0, so no chunking.
fn get(base: &str, path: &str) -> std::io::Result<BufReader<TcpStream>> {
    let (host, prefix) = split(base);
    let mut s = TcpStream::connect(&host)?;
    let path = format!("{}{path}", prefix.trim_end_matches('/'));
    write!(s, "GET {path} HTTP/1.0\r\nHost: {host}\r\nAccept: */*\r\n\r\n")?;
    let mut r = BufReader::new(s);
    let mut line = String::new();
    r.read_line(&mut line)?;
    if !line.split_whitespace().nth(1).is_some_and(|c| c == "200") {
        return Err(std::io::Error::other(format!("{path}: {}", line.trim())));
    }
    loop {
        line.clear();
        if r.read_line(&mut line)? == 0 || line.trim().is_empty() {
            return Ok(r);
        }
    }
}

/// Every `data:` line of /state, sent to `tx`, reconnecting when the server goes away.
fn stream(base: String, tx: mpsc::Sender<String>) {
    loop {
        if let Ok(r) = get(&base, "/state") {
            for line in r.lines() {
                let Ok(line) = line else { break };
                if let Some(data) = line.strip_prefix("data: ")
                    && tx.send(data.to_string()).is_err()
                {
                    return;
                }
            }
        }
        std::thread::sleep(Duration::from_secs(1));
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let base = std::env::args().nth(1).unwrap_or_else(|| "http://127.0.0.1:8787".into());
    let (cols, rows) = ratatui::crossterm::terminal::size()?;
    let mut layout = String::new();
    get(&base, &format!("/layout.json?cols={cols}&rows={}", rows.saturating_sub(1)))
        .map_err(|e| format!("{base}: {e} (is ama-wall running?)"))?
        .read_to_string(&mut layout)?;
    let wall = Player::from_spec(layout)?.max_fps(30.0);
    let (tx, rx) = mpsc::channel();
    std::thread::spawn({
        let base = base.clone();
        move || stream(base, tx)
    });

    ratatui::run(|terminal| -> std::io::Result<()> {
        loop {
            // only the newest state matters
            if let Some(state) = rx.try_iter().last() {
                wall.set_state(state);
            }
            terminal.draw(|f| {
                let area = f.area();
                let [art, foot] = ratatui::layout::Layout::vertical([
                    ratatui::layout::Constraint::Min(1),
                    ratatui::layout::Constraint::Length(1),
                ])
                .areas(area);
                f.render_widget(AsciiArt::new(&wall).fit(Fit::Center), art);
                f.render_widget(Paragraph::new(format!(" {base} · q quit")).dim(), foot);
            })?;
            if event::poll(Duration::from_millis(33))?
                && let Event::Key(k) = event::read()?
                && k.kind == KeyEventKind::Press
                && matches!(k.code, KeyCode::Char('q') | KeyCode::Esc)
            {
                return Ok(());
            }
        }
    })?;
    Ok(())
}
