package asciiart

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"strings"
)

// CastRecorder writes an asciinema cast (asciicast v2), one screen at a time:
// pieces, or any view your app renders.
//
//	rec, _ := asciiart.NewCastRecorder(file, 80, 24, "demo")
//	rec.Frame(0, view)
//	rec.Close(6)
type CastRecorder struct {
	w    io.Writer
	last string
}

// NewCastRecorder starts a cast of a width x height terminal.
func NewCastRecorder(w io.Writer, width, height int, title string) (*CastRecorder, error) {
	head, _ := json.Marshal(map[string]any{"version": 2, "width": width, "height": height, "title": title, "env": map[string]string{"TERM": "xterm-256color"}})
	if _, err := fmt.Fprintf(w, "%s\n", head); err != nil {
		return nil, err
	}
	r := &CastRecorder{w: w}
	return r, r.event(0, "\x1b[?25l\x1b[2J")
}

func (r *CastRecorder) event(t float64, s string) error {
	b, _ := json.Marshal([]any{math.Round(t*1e4) / 1e4, "o", s})
	_, err := fmt.Fprintf(r.w, "%s\n", b)
	return err
}

// Frame records the screen at t seconds. Unchanged screens are left out.
func (r *CastRecorder) Frame(t float64, view string) error {
	s := "\x1b[H" + strings.ReplaceAll(view, "\n", "\r\n")
	if s == r.last {
		return nil
	}
	r.last = s
	return r.event(t, s)
}

// Close ends the cast at t seconds, showing the cursor again.
func (r *CastRecorder) Close(t float64) error { return r.event(t, "\x1b[?25h") }

// WriteCast records seconds of a piece at fps, at its own size, in 24-bit colour.
func WriteCast(w io.Writer, piece Piece, seconds, fps float64) error {
	m := piece.Meta()
	h := m.Rows
	if m.Square {
		h = (m.Rows + 1) / 2
	}
	rec, err := NewCastRecorder(w, m.Cols, h, m.Name)
	if err != nil {
		return err
	}
	n := max(1, int(math.Round(seconds*fps)))
	for i := 0; i < n; i++ {
		t := float64(i) / fps
		f := piece.Draw(t)
		if err := rec.Frame(t, Render(&f, Style{})); err != nil {
			return err
		}
	}
	return rec.Close(seconds)
}
