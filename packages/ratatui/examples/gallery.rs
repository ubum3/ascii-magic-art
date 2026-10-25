//! Browse every piece: ←/→ change piece, ↑/↓ jump ten, `s` cycles looks, `f` cycles
//! fits, space pauses, `q` quits.
//!
//!     cargo run --release --example gallery [slug]

use std::time::Duration;

use ascii_magic_art_ratatui::{AsciiArt, Fit, LookName, Player, SLUGS};
use ratatui::crossterm::event::{self, Event, KeyCode, KeyEventKind};
use ratatui::layout::{Constraint, Layout};
use ratatui::style::Stylize;
use ratatui::text::Line;

const FITS: [Fit; 5] = [
    Fit::Center,
    Fit::Cover,
    Fit::Contain,
    Fit::Stretch,
    Fit::Tile,
];

fn main() -> std::io::Result<()> {
    let start = std::env::args()
        .nth(1)
        .and_then(|s| SLUGS.iter().position(|&x| x == s))
        .unwrap_or(0);
    ratatui::run(|terminal| {
        let (mut i, mut look, mut fit) = (start, LookName::Original, 0);
        let mut player = Player::from_slug(SLUGS[i]).unwrap().look(look);
        loop {
            terminal.draw(|f| {
                let [art, bar] = Layout::vertical([Constraint::Fill(1), Constraint::Length(1)]).areas(f.area());
                f.render_widget(AsciiArt::new(&player).fit(FITS[fit]), art);
                let m = player.meta();
                let status = format!(
                    " {}/{}  {}  {}x{}  look: {}  fit: {:?}{}  ←→ piece  s look  f fit  space pause  q quit",
                    i + 1,
                    SLUGS.len(),
                    m.name,
                    m.cols,
                    m.rows,
                    look.as_str(),
                    FITS[fit],
                    if player.is_paused() { "  (paused)" } else { "" },
                );
                let line = match player.error() {
                    Some(e) => Line::from(format!(" {e}")).red(),
                    None => Line::from(status).dim(),
                };
                f.render_widget(line, bar);
            })?;
            if !event::poll(Duration::from_millis(16))? {
                continue;
            }
            let Event::Key(k) = event::read()? else {
                continue;
            };
            if k.kind != KeyEventKind::Press {
                continue;
            }
            let n = SLUGS.len();
            let next = match k.code {
                KeyCode::Char('q') | KeyCode::Esc => return Ok(()),
                KeyCode::Right => Some((i + 1) % n),
                KeyCode::Left => Some((i + n - 1) % n),
                KeyCode::Down => Some((i + 10) % n),
                KeyCode::Up => Some((i + n - 10) % n),
                KeyCode::Char('s') => {
                    look = look.next();
                    player.set_look(look);
                    None
                }
                KeyCode::Char('f') => {
                    fit = (fit + 1) % FITS.len();
                    None
                }
                KeyCode::Char(' ') => {
                    player.toggle_pause();
                    None
                }
                _ => None,
            };
            if let Some(j) = next {
                i = j;
                player = Player::from_slug(SLUGS[i]).unwrap().look(look);
            }
        }
    })
}
