use ascii_magic_art_payment_states::{Error, normalise, normalise_event, payment_state, statuses};
use ascii_magic_art_ratatui::Piece;

#[test]
fn every_status_loads_and_draws() {
    let all = statuses();
    assert_eq!(all.len(), 18);
    assert_eq!(all[0], "pending");
    for s in all {
        let mut p = payment_state(s).unwrap_or_else(|e| panic!("{s}: {e}"));
        assert!(
            ["ok", "wait", "warn", "fail"].contains(&p.state.tone.as_str()),
            "{s}"
        );
        assert!(!p.label.is_empty());
        let m = p.art.meta().clone();
        let f = p.art.draw(1.5);
        assert_eq!((f.cols, f.rows), (m.cols, m.rows), "{s}");
        if let Some(c) = p.caption.as_mut() {
            let m = c.meta().clone();
            let f = c.draw(1.5);
            assert_eq!((f.cols, f.rows), (m.cols, m.rows), "{s} caption");
        }
    }
}

#[test]
fn aliases_and_events() {
    for (code, want) in [
        ("Authorised", Some("authorised")),
        ("payment_intent.succeeded", Some("authorised")),
        ("REFUSED", Some("declined")),
        ("NOTIFICATION_OF_CHARGEBACK", Some("chargeback")),
        ("payout.paid", Some("payout-sent")),
        ("foo.succeeded", Some("authorised")),
        ("terminal offline", Some("terminal-offline")),
        ("nope", None),
        ("", None),
    ] {
        assert_eq!(normalise(code), want, "{code}");
    }
    assert_eq!(normalise_event("AUTHORISATION", false), Some("declined"));
    assert_eq!(normalise_event("AUTHORISATION", true), Some("authorised"));
    assert_eq!(normalise_event("REFUND", true), Some("refund"));
    assert!(matches!(
        payment_state("nope"),
        Err(Error::UnknownStatus(_))
    ));
}
