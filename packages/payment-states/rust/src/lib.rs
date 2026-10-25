//! Payment, payout, onboarding and POS terminal statuses as ascii-magic-art
//! pieces for ratatui. The table is `states.json`, the same file the JS and Go
//! packages use (copied by `scripts/sync.mjs`).
//!
//! ```no_run
//! use ascii_magic_art_payment_states::{normalise_event, payment_state};
//! let s = payment_state(normalise_event("AUTHORISATION", false).unwrap()).unwrap();
//! assert_eq!(s.label, "Payment declined");
//! // s.art is a JsPiece: draw it with AsciiArt::new(s.art.draw(t)) or a Player.
//! ```

use std::sync::OnceLock;

use ascii_magic_art_ratatui::JsPiece;
use serde_json::{Map, Value};

const RAW: &str = include_str!("../states.json");

struct Table {
    states: Map<String, Value>,
    aliases: Vec<(String, String)>,
    outcomes: Map<String, Value>,
}

fn table() -> &'static Table {
    static T: OnceLock<Table> = OnceLock::new();
    T.get_or_init(|| {
        let v: Value = serde_json::from_str(RAW).expect("states.json");
        let obj = |k: &str| v[k].as_object().cloned().unwrap_or_default();
        let mut aliases = Vec::new();
        for (status, names) in obj("aliases") {
            for n in names.as_array().into_iter().flatten() {
                if let Some(n) = n.as_str() {
                    aliases.push((n.to_string(), status.clone()));
                }
            }
        }
        Table {
            states: obj("states"),
            aliases,
            outcomes: obj("outcomes"),
        }
    })
}

/// Every status, in table order.
pub fn statuses() -> Vec<&'static str> {
    table().states.keys().map(String::as_str).collect()
}

fn key(code: &str) -> String {
    code.trim()
        .to_lowercase()
        .split(|c: char| c == '_' || c.is_whitespace())
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn lookup(k: &str) -> Option<&'static str> {
    let t = table();
    if let Some((s, _)) = t.states.get_key_value(k) {
        return Some(s.as_str());
    }
    t.aliases
        .iter()
        .find(|(a, _)| a == k)
        .map(|(_, s)| t.states.get_key_value(s).unwrap().0.as_str())
}

/// A status, an alias or a PSP event code to a status, or `None`.
/// Case, spaces and underscores don't matter; `x.succeeded` falls back to `succeeded`.
pub fn normalise(code: &str) -> Option<&'static str> {
    let k = key(code);
    if k.is_empty() {
        return None;
    }
    lookup(&k).or_else(|| k.rfind('.').and_then(|i| lookup(&k[i + 1..])))
}

/// [`normalise`] for an event with a success flag (Adyen sends AUTHORISATION,
/// REFUND, CAPTURE... with success true or false).
pub fn normalise_event(code: &str, success: bool) -> Option<&'static str> {
    match table().outcomes.get(&key(code)).and_then(Value::as_array) {
        Some(o) => o
            .get(if success { 0 } else { 1 })
            .and_then(Value::as_str)
            .and_then(lookup),
        None => normalise(code),
    }
}

/// What shows a status. `slug` is a library piece; `spec` an extras spec (JSON)
/// when there is no piece; `caption` a small text spec to show under the art.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct State {
    pub status: &'static str,
    pub tone: String,
    pub label: String,
    pub slug: Option<String>,
    pub spec: Option<String>,
    pub caption: Option<String>,
}

/// What can go wrong.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Error {
    /// Neither a status nor an alias.
    UnknownStatus(String),
    /// Loading a piece failed.
    Art(ascii_magic_art_ratatui::Error),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::UnknownStatus(s) => write!(
                f,
                "unknown payment status {s:?}: one of {}, or an alias in states.json",
                statuses().join(", ")
            ),
            Error::Art(e) => e.fmt(f),
        }
    }
}

impl std::error::Error for Error {}

impl From<ascii_magic_art_ratatui::Error> for Error {
    fn from(e: ascii_magic_art_ratatui::Error) -> Self {
        Error::Art(e)
    }
}

/// Look a status (or alias) up in the table.
pub fn resolve(status: &str) -> Result<State, Error> {
    let s = normalise(status).ok_or_else(|| Error::UnknownStatus(status.to_string()))?;
    let e = &table().states[s];
    let text = |k: &str| e.get(k).and_then(Value::as_str).map(str::to_string);
    let json = |k: &str| e.get(k).map(Value::to_string);
    Ok(State {
        status: s,
        tone: text("tone").unwrap_or_default(),
        label: text("label").unwrap_or_default(),
        slug: text("slug"),
        spec: json("spec"),
        caption: json("caption"),
    })
}

/// A resolved status with its pieces loaded: `art` always, `caption` when the
/// status has one. Both are pieces like any other (a `Player`, `AsciiArt`).
pub struct PaymentState {
    pub state: State,
    pub label: String,
    pub art: JsPiece,
    pub caption: Option<JsPiece>,
}

/// Resolve a status and load its pieces.
pub fn payment_state(status: &str) -> Result<PaymentState, Error> {
    let state = resolve(status)?;
    let art = match (&state.slug, &state.spec) {
        (Some(slug), _) => JsPiece::new(slug)?,
        (None, Some(spec)) => JsPiece::from_spec(spec)?,
        (None, None) => return Err(Error::UnknownStatus(status.to_string())),
    };
    let caption = state
        .caption
        .as_deref()
        .map(JsPiece::from_spec)
        .transpose()?;
    Ok(PaymentState {
        label: state.label.clone(),
        state,
        art,
        caption,
    })
}
