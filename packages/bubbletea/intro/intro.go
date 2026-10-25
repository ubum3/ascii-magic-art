// Package intro plays a piece as a splash screen before your Bubble Tea app: it
// fades in, holds, fades out (any key skips ahead), then hands the program over to
// your model.
//
//	art := asciiart.MustSlug(slug.MoonlitSea)
//	p := tea.NewProgram(intro.New(art, myApp{}, intro.Title("My App"), intro.Subtitle("v1.0")))
//	if _, err := p.Run(); err != nil { ... }
//
// Your model receives a tea.WindowSizeMsg right after its Init, as if it had started first.
package intro

import (
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
)

// tickMsg drives the fades between the art's own frames.
type tickMsg struct {
	id  *Model
	now time.Time
}

// Model is a top-level tea.Model that plays the intro, then becomes next.
type Model struct {
	self                  *Model // identity across copies, for tickMsg
	art                   asciiart.Model
	next                  tea.Model
	title, subtitle, hint string
	fadeIn, hold, fadeOut time.Duration
	untilKey, skippable   bool
	box, alt              bool
	accent, ink, bg       asciiart.RGB
	start                 time.Time
	skippedAt             time.Time
	skipAlpha             float64
	skipped               bool
	width, height         int
}

// Option sets up an intro.
type Option func(*Model)

// Title is the big line in the middle.
func Title(s string) Option { return func(m *Model) { m.title = s } }

// Subtitle goes under the title.
func Subtitle(s string) Option { return func(m *Model) { m.subtitle = s } }

// Hint is a small line under the subtitle, such as "press any key".
func Hint(s string) Option { return func(m *Model) { m.hint = s } }

// FadeIn sets the fade-in time. Default 600ms.
func FadeIn(d time.Duration) Option { return func(m *Model) { m.fadeIn = d } }

// Hold sets how long it stays at full strength. Default 2.4s.
func Hold(d time.Duration) Option { return func(m *Model) { m.hold = d } }

// FadeOut sets the fade-out time. Default 600ms.
func FadeOut(d time.Duration) Option { return func(m *Model) { m.fadeOut = d } }

// UntilKey holds until a key is pressed (a "press any key" splash).
func UntilKey() Option { return func(m *Model) { m.untilKey, m.skippable = true, true } }

// Skippable sets whether a key skips to the fade-out. Default true.
func Skippable(on bool) Option { return func(m *Model) { m.skippable = on } }

// Accent is the title's colour. Default white.
func Accent(c asciiart.RGB) Option { return func(m *Model) { m.accent = c } }

// Background is the colour it fades from and to. Default black.
func Background(c asciiart.RGB) Option { return func(m *Model) { m.bg = c } }

// TitleBox draws a rounded box behind the title. Default true.
func TitleBox(on bool) Option { return func(m *Model) { m.box = on } }

// AltScreen plays the intro in the alternate screen. Default true.
func AltScreen(on bool) Option { return func(m *Model) { m.alt = on } }

// New plays art as an intro, then hands over to next. The art fills the window
// (asciiart.FitCover) unless you gave it another fit.
func New(art asciiart.Model, next tea.Model, opts ...Option) *Model {
	m := &Model{
		art: art, next: next,
		fadeIn: 600 * time.Millisecond, hold: 2400 * time.Millisecond, fadeOut: 600 * time.Millisecond,
		skippable: true, box: true, alt: true,
		accent: asciiart.RGB{R: 255, G: 255, B: 255}, ink: asciiart.RGB{R: 170, G: 170, B: 170},
	}
	m.self = m
	if m.art.Style().Fit == asciiart.FitCenter {
		m.art.SetFit(asciiart.FitCover)
	}
	for _, o := range opts {
		o(m)
	}
	return m
}

func (m *Model) tick() tea.Cmd {
	id := m.self
	return tea.Tick(time.Second/30, func(t time.Time) tea.Msg { return tickMsg{id, t} })
}

// Init starts the art and the fade clock.
func (m *Model) Init() tea.Cmd { return tea.Batch(m.art.Init(), m.tick()) }

// AlphaAt is how visible the intro is at now: 0 is gone, 1 is full strength.
func (m *Model) AlphaAt(now time.Time) float64 {
	if m.start.IsZero() {
		return 0
	}
	if m.skipped {
		fo := m.fadeOut.Seconds() * m.skipAlpha
		if fo <= 0 {
			return 0
		}
		return max(0, m.skipAlpha*(1-now.Sub(m.skippedAt).Seconds()/fo))
	}
	e := now.Sub(m.start).Seconds()
	if fi := m.fadeIn.Seconds(); e < fi {
		return e / fi
	}
	if m.untilKey {
		return 1
	}
	e -= m.fadeIn.Seconds() + m.hold.Seconds()
	switch fo := m.fadeOut.Seconds(); {
	case e < 0:
		return 1
	case e < fo:
		return 1 - e/fo
	}
	return 0
}

// DoneAt is true once it has faded out.
func (m *Model) DoneAt(now time.Time) bool {
	switch {
	case m.start.IsZero():
		return false
	case m.skipped:
		return m.AlphaAt(now) <= 0
	case m.untilKey:
		return false
	}
	return now.Sub(m.start) >= m.fadeIn+m.hold+m.fadeOut
}

// Skip fades out from wherever it is. Does nothing if not skippable.
func (m *Model) Skip(now time.Time) {
	if m.skippable && !m.skipped && !m.start.IsZero() {
		m.skipAlpha, m.skippedAt, m.skipped = m.AlphaAt(now), now, true
	}
}

// Update plays the intro, and once it's done returns next in its place.
func (m *Model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.width, m.height = msg.Width, msg.Height
		m.art.SetSize(msg.Width, msg.Height)
		return m, nil
	case tea.KeyPressMsg:
		switch msg.String() {
		case "ctrl+c", "esc", "q":
			return m, tea.Quit
		}
		m.Skip(time.Now())
		return m, nil
	case tickMsg:
		if msg.id != m.self {
			return m, nil
		}
		if m.start.IsZero() && m.art.Ready() {
			m.start = msg.now // the clock starts with the first frame on screen
		}
		if m.DoneAt(msg.now) {
			return m.handOff()
		}
		return m, m.tick()
	}
	var cmd tea.Cmd
	m.art, cmd = m.art.Update(msg)
	return m, cmd
}

func (m *Model) handOff() (tea.Model, tea.Cmd) {
	m.art.Pause()
	// The same order a program uses: Init, then the window size.
	next := m.next
	initCmd := next.Init()
	var sizeCmd tea.Cmd
	if m.width > 0 && m.height > 0 {
		next, sizeCmd = next.Update(tea.WindowSizeMsg{Width: m.width, Height: m.height})
	}
	return next, tea.Batch(initCmd, sizeCmd)
}

// View draws the art, faded, with the title card over it.
func (m *Model) View() tea.View {
	now := time.Now()
	a := m.AlphaAt(now)
	m.art.SetDim(1 - a)
	st := m.art.Style()
	st.BG = &m.bg
	m.art.SetStyle(st)
	out := m.art.View()
	if card := m.card(a); card != "" && m.width > 0 {
		out = asciiart.Background(out, card, m.width, m.height)
	}
	v := tea.NewView(out)
	v.AltScreen = m.alt
	v.BackgroundColor = lipglossColor(m.bg)
	return v
}

func (m *Model) card(a float64) string {
	fade := func(c asciiart.RGB) lipgloss.Style {
		return lipgloss.NewStyle().Foreground(lipglossColor(c.Mix(m.bg, 1-a))).Background(lipglossColor(m.bg))
	}
	var lines []string
	if m.title != "" {
		lines = append(lines, fade(m.accent).Bold(true).Render(m.title))
	}
	if m.subtitle != "" {
		lines = append(lines, fade(m.ink).Render(m.subtitle))
	}
	if m.hint != "" {
		lines = append(lines, fade(m.ink.Mix(m.bg, 0.4)).Render(m.hint))
	}
	if len(lines) == 0 {
		return ""
	}
	body := lipgloss.JoinVertical(lipgloss.Center, lines...)
	s := lipgloss.NewStyle().Background(lipglossColor(m.bg)).Padding(0, 2)
	if m.box {
		s = s.Border(lipgloss.RoundedBorder()).
			BorderForeground(lipglossColor(m.accent.Mix(m.bg, 0.5).Mix(m.bg, 1-a))).
			BorderBackground(lipglossColor(m.bg))
	}
	return s.Render(body)
}

func lipglossColor(c asciiart.RGB) lipgloss.RGBColor {
	return lipgloss.RGBColor{R: c.R, G: c.G, B: c.B}
}
