// Gallery browses every piece: ←/→ change piece, ↑/↓ jump ten, s cycles looks,
// f cycles fits, space pauses, q quits.
//
//	go run ./examples/gallery [slug]
package main

import (
	"fmt"
	"os"
	"slices"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

var fits = []asciiart.Fit{asciiart.FitCenter, asciiart.FitCover, asciiart.FitContain, asciiart.FitStretch, asciiart.FitTile}

type model struct {
	art    asciiart.Model
	i, fit int
	look   asciiart.LookName
	w, h   int
}

func (m *model) load() tea.Cmd {
	m.art = asciiart.MustSlug(slug.All[m.i], asciiart.WithLook(asciiart.LookOf(m.look)), asciiart.WithFit(fits[m.fit]), asciiart.WithSize(m.w, m.h-1))
	return m.art.Init()
}

func (m model) Init() tea.Cmd { return m.art.Init() }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	n := len(slug.All)
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
		m.art.SetSize(m.w, m.h-1)
		return m, nil
	case tea.KeyPressMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		case "right":
			m.i = (m.i + 1) % n
		case "left":
			m.i = (m.i + n - 1) % n
		case "down":
			m.i = (m.i + 10) % n
		case "up":
			m.i = (m.i + n - 10) % n
		case "s":
			m.look = m.look.Next()
			return m, m.art.SetLook(asciiart.LookOf(m.look))
		case "f":
			m.fit = (m.fit + 1) % len(fits)
			m.art.SetFit(fits[m.fit])
			return m, nil
		case "space":
			return m, m.art.TogglePause()
		default:
			return m, nil
		}
		return m, m.load()
	}
	var cmd tea.Cmd
	m.art, cmd = m.art.Update(msg)
	return m, cmd
}

func (m model) View() tea.View {
	meta := m.art.Meta()
	look := m.look
	if look == "" {
		look = asciiart.Original
	}
	paused := ""
	if m.art.Paused() {
		paused = "  (paused)"
	}
	status := fmt.Sprintf(" %d/%d  %s  %dx%d  look: %s  fit: %s%s  ←→ piece  s look  f fit  space pause  q quit",
		m.i+1, len(slug.All), meta.Name, meta.Cols, meta.Rows, look, fits[m.fit], paused)
	bar := lipgloss.NewStyle().Faint(true).Render(status)
	if err := m.art.Err(); err != nil {
		bar = lipgloss.NewStyle().Foreground(lipgloss.Red).Render(" " + err.Error())
	}
	v := tea.NewView(m.art.View() + "\n" + bar)
	v.AltScreen = true
	return v
}

func main() {
	m := model{look: asciiart.Original}
	if len(os.Args) > 1 {
		if i := slices.Index(slug.All, os.Args[1]); i >= 0 {
			m.i = i
		}
	}
	m.load()
	if _, err := tea.NewProgram(m).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
