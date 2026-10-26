// The payments wall in a terminal: the layout from ama-wall (packages/wall), sized
// to this terminal, with its state streamed over SSE. One model, one SetState per
// update. q quits.
//
//	npx ama-wall                          # in another terminal: mock payments on :8787
//	go run ./examples/wall [http://127.0.0.1:8787]
package main

import (
	"bufio"
	"fmt"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
)

type (
	stateMsg  string
	layoutMsg asciiart.Model
	errMsg    struct{ error }
)

type wall struct {
	art     *asciiart.Model // nil until the layout for this size arrives
	base    string
	state   string // the newest state, kept until there is a model to give it to
	w, h    int
	loading bool
	err     error
}

// load fetches the layout sized to the terminal and makes the model for it.
func load(base string, cols, rows int) tea.Cmd {
	return func() tea.Msg {
		res, err := (&http.Client{Timeout: 5 * time.Second}).Get(fmt.Sprintf("%s/layout.json?cols=%d&rows=%d", base, cols, rows))
		if err != nil {
			return errMsg{fmt.Errorf("%w (is ama-wall running?)", err)}
		}
		defer res.Body.Close()
		layout, err := io.ReadAll(res.Body)
		if err != nil || res.StatusCode != http.StatusOK {
			return errMsg{fmt.Errorf("%s/layout.json: %s %v", base, res.Status, err)}
		}
		art, err := asciiart.FromSpec(string(layout), asciiart.WithFit(asciiart.FitCenter), asciiart.WithMaxFPS(30))
		if err != nil {
			return errMsg{err}
		}
		return layoutMsg(art)
	}
}

func (m wall) Init() tea.Cmd { return nil }

func (m wall) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		m.w, m.h = msg.Width, msg.Height
		if m.art == nil && !m.loading {
			m.loading = true
			return m, load(m.base, m.w, max(1, m.h-1))
		}
		if m.art != nil {
			m.art.SetSize(m.w, max(1, m.h-1))
		}
	case tea.KeyPressMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return m, tea.Quit
		}
	case errMsg:
		m.err = msg.error
		return m, tea.Quit
	case layoutMsg:
		art := asciiart.Model(msg)
		art.SetSize(m.w, max(1, m.h-1))
		m.art = &art
		cmds = append(cmds, art.Init())
		if m.state != "" {
			cmds = append(cmds, m.art.SetState(m.state))
		}
	case stateMsg:
		m.state = string(msg)
		if m.art != nil {
			cmds = append(cmds, m.art.SetState(m.state))
		}
	}
	if m.art != nil {
		art, cmd := m.art.Update(msg)
		m.art = &art
		cmds = append(cmds, cmd)
	}
	return m, tea.Batch(cmds...)
}

func (m wall) View() tea.View {
	body := "connecting to " + m.base + "…"
	if m.art != nil {
		body = m.art.View()
	}
	foot := lipgloss.NewStyle().Faint(true).Render(" " + m.base + " · q quit")
	v := tea.NewView(lipgloss.JoinVertical(lipgloss.Left, body, foot))
	v.AltScreen = true
	return v
}

// stream sends every data: line of /state to the program, reconnecting when the
// server goes away. The client has no timeout: the stream is meant to stay open.
func stream(base string, p *tea.Program) {
	for {
		if res, err := http.Get(base + "/state"); err == nil {
			sc := bufio.NewScanner(res.Body)
			sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
			for sc.Scan() {
				if data, ok := strings.CutPrefix(sc.Text(), "data: "); ok {
					p.Send(stateMsg(data))
				}
			}
			res.Body.Close()
		}
		time.Sleep(time.Second)
	}
}

func fail(err error) {
	fmt.Fprintln(os.Stderr, err)
	os.Exit(1)
}

func main() {
	base := "http://127.0.0.1:8787"
	if len(os.Args) > 1 {
		base = strings.TrimRight(os.Args[1], "/")
	}
	p := tea.NewProgram(wall{base: base})
	go stream(base, p)
	m, err := p.Run()
	if err != nil {
		fail(err)
	}
	if w, ok := m.(wall); ok && w.err != nil {
		fail(w.err)
	}
}
