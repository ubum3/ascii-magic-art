// Background puts a panel over a dimmed, full-screen piece. q quits.
//
//	go run ./examples/background [slug]
package main

import (
	"fmt"
	"os"
	"strings"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

type model struct {
	art  asciiart.Model
	w, h int
}

func (m model) Init() tea.Cmd { return m.art.Init() }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
		m.art.SetSize(m.w, m.h)
		return m, nil
	case tea.KeyPressMsg:
		if s := msg.String(); s == "q" || s == "esc" || s == "ctrl+c" {
			return m, tea.Quit
		}
	}
	var cmd tea.Cmd
	m.art, cmd = m.art.Update(msg)
	return m, cmd
}

func (m model) View() tea.View {
	jobs := []string{"deploy api       ✓", "migrate db       ✓", "warm caches      …", "notify team"}
	panel := lipgloss.NewStyle().
		Border(lipgloss.RoundedBorder()).BorderForeground(lipgloss.Color("#ff6ad5")).
		Background(lipgloss.Black).Padding(1, 3).Width(min(60, max(20, m.w-8))).
		Render(lipgloss.NewStyle().Bold(true).Render("Welcome back") + "\n\n" +
			"Background: " + m.art.Meta().Name + "\n\n" + strings.Join(jobs, "\n"))
	v := tea.NewView(asciiart.Background(m.art.View(), panel, m.w, m.h))
	v.AltScreen = true
	return v
}

func main() {
	name := slug.SynthwaveGrid
	if len(os.Args) > 1 {
		name = os.Args[1]
	}
	art, err := asciiart.FromSlug(name, asciiart.WithFit(asciiart.FitCover), asciiart.WithDim(0.6))
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	if _, err := tea.NewProgram(model{art: art}).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
