// Intro plays a splash screen, then hands the program to the app. Any key skips
// the intro; q quits.
//
//	go run ./examples/intro [slug]
package main

import (
	"fmt"
	"os"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/intro"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

type app struct{ w, h int }

func (a app) Init() tea.Cmd { return nil }

func (a app) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		a.w, a.h = msg.Width, msg.Height
	case tea.KeyPressMsg:
		if s := msg.String(); s == "q" || s == "esc" || s == "ctrl+c" {
			return a, tea.Quit
		}
	}
	return a, nil
}

func (a app) View() tea.View {
	body := "This is your app.\n\nThe intro faded out and handed the program over.\n\nPress q to quit."
	box := lipgloss.NewStyle().Border(lipgloss.NormalBorder()).Width(max(10, a.w-2)).Height(max(3, a.h-2)).
		AlignHorizontal(lipgloss.Center).PaddingTop(2).Render(body)
	v := tea.NewView(box)
	v.AltScreen = true
	return v
}

func main() {
	name := slug.MoonlitSea
	if len(os.Args) > 1 {
		name = os.Args[1]
	}
	art, err := asciiart.FromSlug(name)
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	splash := intro.New(art, app{},
		intro.Title("ACME CLI"),
		intro.Subtitle("v2.4.0 · the friendly deploy tool"),
		intro.Hint("press any key"),
		intro.Accent(asciiart.MustHex("#ffd86b")),
	)
	if _, err := tea.NewProgram(splash).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
