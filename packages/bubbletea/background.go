package asciiart

import (
	"charm.land/lipgloss/v2"
)

// Background draws content centred over art, both w x h: the art is the bottom
// layer and every cell of content (spaces too) sits on top. Give the art its size
// first, for example with art.SetSize(w, h) and WithFit(FitCover).
//
//	func (m model) View() tea.View {
//	    panel := lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(1, 4).Render("Welcome")
//	    return tea.NewView(asciiart.Background(m.art.View(), panel, m.w, m.h))
//	}
func Background(art, content string, w, h int) string {
	cw, ch := lipgloss.Width(content), lipgloss.Height(content)
	return Overlay(art, content, (w-cw)/2, (h-ch)/2)
}

// Overlay draws content over base with its top-left corner at x, y.
func Overlay(base, content string, x, y int) string {
	return lipgloss.NewCompositor(
		lipgloss.NewLayer(base),
		lipgloss.NewLayer(content).X(max(0, x)).Y(max(0, y)).Z(1),
	).Render()
}
