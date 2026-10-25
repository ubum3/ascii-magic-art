package intro

import (
	"math"
	"strings"
	"testing"
	"time"

	tea "charm.land/bubbletea/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

type app struct{ w, h int }

func (a app) Init() tea.Cmd { return nil }
func (a app) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	if s, ok := msg.(tea.WindowSizeMsg); ok {
		a.w, a.h = s.Width, s.Height
	}
	return a, nil
}
func (a app) View() tea.View { return tea.NewView("app") }

func near(a, b float64) bool { return math.Abs(a-b) < 1e-3 }

func started(opts ...Option) (*Model, time.Time) {
	m := New(asciiart.MustSlug(slug.MatrixRain), app{}, append([]Option{FadeIn(time.Second), Hold(2 * time.Second), FadeOut(time.Second)}, opts...)...)
	t0 := time.Now()
	m.start = t0
	return m, t0
}

func TestTimeline(t *testing.T) {
	m, t0 := started()
	at := func(ms int) time.Time { return t0.Add(time.Duration(ms) * time.Millisecond) }
	if !near(m.AlphaAt(at(500)), 0.5) || m.AlphaAt(at(2000)) != 1 || !near(m.AlphaAt(at(3500)), 0.5) {
		t.Fatal("fade in, hold, fade out")
	}
	if m.DoneAt(at(3900)) || !m.DoneAt(at(4000)) {
		t.Fatal("done after 4s")
	}
	m.Skip(at(500))
	if !near(m.AlphaAt(at(750)), 0.25) || !m.DoneAt(at(1000)) {
		t.Fatal("skip fades out from where it was")
	}
	u, t1 := started(UntilKey())
	if u.AlphaAt(t1.Add(time.Hour)) != 1 || u.DoneAt(t1.Add(time.Hour)) {
		t.Fatal("until key holds")
	}
}

func TestHandsOffToNext(t *testing.T) {
	m, t0 := started(Title("Hello"))
	m.Update(tea.WindowSizeMsg{Width: 40, Height: 12})
	if v := m.View().Content; !strings.Contains(v, "Hello") || strings.Count(v, "\n") != 11 {
		t.Fatalf("title card over a 40x12 view:\n%s", v)
	}
	next, _ := m.Update(tickMsg{m.self, t0.Add(5 * time.Second)})
	if _, ok := next.(app); !ok {
		t.Fatalf("handed off to %T", next)
	}
	if a := next.(app); a.w != 40 || a.h != 12 {
		t.Fatalf("next got size %dx%d", a.w, a.h)
	}
}
