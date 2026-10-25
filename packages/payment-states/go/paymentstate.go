// Package paymentstate shows payment, payout, onboarding and POS terminal
// statuses as ascii-magic-art pieces in Bubble Tea. The table is states.json,
// the same file the JS and Rust packages use (copied by scripts/sync.mjs).
//
//	s, err := paymentstate.New(paymentstate.NormaliseEvent("AUTHORISATION", false), asciiart.Look{})
//	// s.Art plays empty-payment-failed; s.Label is "Payment declined"
package paymentstate

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
)

//go:embed states.json
var raw []byte

type entry struct {
	Tone    string          `json:"tone"`
	Label   string          `json:"label"`
	Slug    string          `json:"slug"`
	Spec    json.RawMessage `json:"spec"`
	Caption json.RawMessage `json:"caption"`
}

var table struct {
	States   map[string]entry     `json:"states"`
	Aliases  map[string][]string  `json:"aliases"`
	Outcomes map[string][2]string `json:"outcomes"`
}

var (
	alias    = map[string]string{}
	statuses []string
)

func init() {
	if err := json.Unmarshal(raw, &table); err != nil {
		panic("paymentstate: states.json: " + err.Error())
	}
	for status, names := range table.Aliases {
		for _, n := range names {
			alias[n] = status
		}
	}
	// Table order, which a Go map drops: walk the keys of "states" as tokens.
	var top struct {
		States json.RawMessage `json:"states"`
	}
	_ = json.Unmarshal(raw, &top)
	d := json.NewDecoder(bytes.NewReader(top.States))
	_, _ = d.Token()
	for d.More() {
		t, _ := d.Token()
		statuses = append(statuses, t.(string))
		var skip json.RawMessage
		_ = d.Decode(&skip)
	}
}

// Statuses is every status, in table order.
func Statuses() []string { return append([]string(nil), statuses...) }

func key(code string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(strings.TrimSpace(code)), func(r rune) bool { return r == '_' || r == ' ' || r == '\t' }), "-")
}

// Normalise maps a status, an alias or a PSP event code to a status, or "".
// Case, spaces and underscores don't matter; "x.succeeded" falls back to "succeeded".
func Normalise(code string) string {
	k := key(code)
	if k == "" {
		return ""
	}
	if _, ok := table.States[k]; ok {
		return k
	}
	if s, ok := alias[k]; ok {
		return s
	}
	if i := strings.LastIndexByte(k, '.'); i >= 0 {
		tail := k[i+1:]
		if _, ok := table.States[tail]; ok {
			return tail
		}
		return alias[tail]
	}
	return ""
}

// NormaliseEvent is Normalise for an event with a success flag (Adyen sends
// AUTHORISATION, REFUND, CAPTURE... with success true or false).
func NormaliseEvent(code string, success bool) string {
	if o, ok := table.Outcomes[key(code)]; ok {
		if success {
			return o[0]
		}
		return o[1]
	}
	return Normalise(code)
}

// State is what shows a status. Slug is a library piece; Spec an extras spec
// (JSON) when there is no piece; Caption a small text spec to show under the art.
type State struct {
	Status, Tone, Label string
	Slug                string
	Spec, Caption       string
}

// UnknownStatusError is returned for a status that is neither a status nor an alias.
type UnknownStatusError struct{ Status string }

func (e *UnknownStatusError) Error() string {
	return fmt.Sprintf("unknown payment status %q: one of %s, or an alias in states.json", e.Status, strings.Join(statuses, ", "))
}

// Resolve looks a status (or alias) up in the table.
func Resolve(status string) (State, error) {
	s := Normalise(status)
	if s == "" {
		return State{}, &UnknownStatusError{status}
	}
	e := table.States[s]
	return State{Status: s, Tone: e.Tone, Label: e.Label, Slug: e.Slug, Spec: string(e.Spec), Caption: string(e.Caption)}, nil
}

// Art is a resolved status with its pieces loaded: Art always, Caption when the
// status has one. Both play like any other piece (asciiart.NewModel and friends).
type Art struct {
	State
	Art     *asciiart.JSPiece
	Caption *asciiart.JSPiece
}

// New resolves a status and loads its pieces in a look (the zero Look is the original).
func New(status string, look asciiart.Look) (*Art, error) {
	s, err := Resolve(status)
	if err != nil {
		return nil, err
	}
	a := &Art{State: s}
	if s.Slug != "" {
		a.Art, err = asciiart.NewJSPiece(s.Slug, look)
	} else {
		a.Art, err = asciiart.NewSpecPiece(s.Spec, look)
	}
	if err != nil {
		return nil, err
	}
	if s.Caption != "" {
		if a.Caption, err = asciiart.NewSpecPiece(s.Caption, look); err != nil {
			return nil, err
		}
	}
	return a, nil
}
