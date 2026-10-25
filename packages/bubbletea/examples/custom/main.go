// Custom plays your own piece, written in Go with a Grid. It works as a
// background or an intro too. q quits.
//
//	go run ./examples/custom
package main

import (
	"fmt"
	"math"
	"os"

	tea "charm.land/bubbletea/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
)

// buildBadge is a plasma field with a build badge on top.
type buildBadge struct {
	meta asciiart.Meta
	g    *asciiart.Grid
}

func newBuildBadge() *buildBadge {
	meta := asciiart.NewMeta("build-badge", 60, 15)
	meta.Name = "Build Badge"
	meta.Palette = asciiart.NewPalette("#7ee787", "#8b949e", "#1f6feb", "#58a6ff", "#a5d6ff")
	return &buildBadge{meta: meta, g: asciiart.NewGrid(60, 15)}
}

func (b *buildBadge) Meta() asciiart.Meta { return b.meta }

func (b *buildBadge) Draw(t float64) asciiart.Frame {
	g := b.g.Clear()
	// Plasma: a sum of sines, shaded with a ramp and coloured by value.
	g.Shade(func(x, y int, _, _ float64) (rune, rune, bool) {
		fx, fy := float64(x), float64(y)*2
		v := (math.Sin(fx*0.11+t)+math.Sin(fy*0.13-t*0.7)+math.Sin((fx+fy)*0.07+t*0.5))/6 + 0.5
		key := []rune("234")[min(2, int(v*3))]
		return asciiart.Ramp(v, asciiart.Ramps.Classic), key, true
	})
	x, y, w := 15, 5, 30
	g.Fill(x, y, w, 5, ' ', ' ')
	g.Box(x, y, w, 5, asciiart.BoxRound, '1')
	g.Text(x+3, y+1, "build-badge", '1')
	g.Text(x+3, y+2, fmt.Sprintf("✓ build #%d passed", 1200+int(t)), '0')
	g.HLine(x+3, x+3+int(math.Mod(t, 4)/4*24), y+3, '━', '0')
	return g.Frame(&b.meta.Palette)
}

type model struct{ art asciiart.Model }

func (m model) Init() tea.Cmd { return m.art.Init() }

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.art.SetSize(msg.Width, msg.Height)
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
	v := tea.NewView(m.art.View())
	v.AltScreen = true
	return v
}

func main() {
	if _, err := tea.NewProgram(model{asciiart.New(newBuildBadge())}).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
