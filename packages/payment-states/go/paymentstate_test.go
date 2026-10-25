package paymentstate

import (
	"strings"
	"testing"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
)

func TestEveryStatusLoadsAndDraws(t *testing.T) {
	if len(Statuses()) != 18 || Statuses()[0] != "pending" {
		t.Fatalf("statuses: %v", Statuses())
	}
	for _, s := range Statuses() {
		a, err := New(s, asciiart.Look{})
		if err != nil {
			t.Fatalf("%s: %v", s, err)
		}
		for _, p := range []*asciiart.JSPiece{a.Art, a.Caption} {
			if p == nil {
				continue
			}
			m := p.Meta()
			f := p.Draw(1.5)
			if f.Cols != m.Cols || f.Rows != m.Rows || len(f.Cells) != m.Cols*m.Rows {
				t.Fatalf("%s: frame %dx%d, meta %dx%d", s, f.Cols, f.Rows, m.Cols, m.Rows)
			}
		}
		if a.Label == "" || !strings.Contains("ok wait warn fail", a.Tone) {
			t.Fatalf("%s: label %q tone %q", s, a.Label, a.Tone)
		}
	}
}

func TestNormalise(t *testing.T) {
	cases := map[string]string{
		"Authorised": "authorised", "payment_intent.succeeded": "authorised", "REFUSED": "declined",
		"NOTIFICATION_OF_CHARGEBACK": "chargeback", "payout.paid": "payout-sent", "foo.succeeded": "authorised",
		"terminal offline": "terminal-offline", "429": "rate-limited", "nope": "", "": "",
	}
	for in, want := range cases {
		if got := Normalise(in); got != want {
			t.Errorf("Normalise(%q) = %q, want %q", in, got, want)
		}
	}
	if NormaliseEvent("AUTHORISATION", false) != "declined" || NormaliseEvent("AUTHORISATION", true) != "authorised" {
		t.Error("AUTHORISATION outcomes")
	}
	if NormaliseEvent("REFUND", false) != "declined" || NormaliseEvent("REFUND", true) != "refund" {
		t.Error("REFUND outcomes")
	}
	if _, err := New("nope", asciiart.Look{}); err == nil || !strings.Contains(err.Error(), "one of pending, authorised") {
		t.Errorf("unknown status error: %v", err)
	}
}
