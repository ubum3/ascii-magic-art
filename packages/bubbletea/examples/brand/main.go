// A logo intro that dissolves into a small dashboard drawn with extras: a progress
// bar, a sparkline and a ticker fed live. c celebrates, q quits.
//
//	go run ./examples/brand [logo.json]
//
// Make your own logo spec with `npx ama-studio brand logo.svg --effect assemble -o logo.json`.
package main

import (
	_ "embed"
	"fmt"
	"math"
	"os"
	"time"

	tea "charm.land/bubbletea/v2"
	"charm.land/lipgloss/v2"

	asciiart "github.com/ubum3/ascii-magic-art/packages/bubbletea"
	"github.com/ubum3/ascii-magic-art/packages/bubbletea/intro"
)

//go:embed mark.json
var mark []byte

type feedMsg time.Time

type dash struct {
	progress, spark, ticker asciiart.Model
	party                   *asciiart.Model
	partyAt                 time.Time
	values                  []float64
	start                   time.Time
	w, h                    int
}

func must(m asciiart.Model, err error) asciiart.Model {
	if err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	return m
}

func newDash() dash {
	return dash{
		progress: must(asciiart.ProgressSpec(44).With("label", "Settling batch").Model()),
		spark:    must(asciiart.SparklineSpec(44, 6).With("label", "Payments / min").Model()),
		ticker:   must(asciiart.TickerSpec(96).Model()),
		start:    time.Now(),
	}
}

func feed() tea.Cmd {
	return tea.Tick(100*time.Millisecond, func(t time.Time) tea.Msg { return feedMsg(t) })
}

func (d dash) Init() tea.Cmd {
	return tea.Batch(d.progress.Init(), d.spark.Init(), d.ticker.Init(), feed())
}

func (d dash) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmds []tea.Cmd
	switch msg := msg.(type) {
	case tea.WindowSizeMsg:
		d.w, d.h = msg.Width, msg.Height
	case tea.KeyPressMsg:
		switch msg.String() {
		case "q", "esc", "ctrl+c":
			return d, tea.Quit
		case "c":
			p := must(asciiart.CelebrateSpec("Payment approved", asciiart.Check).With("cols", 40).With("rows", 12).Model())
			d.party, d.partyAt = &p, time.Now()
			cmds = append(cmds, p.Init())
		}
	case feedMsg:
		t := time.Since(d.start).Seconds()
		if float64(len(d.values))*0.25 < t {
			d.values = append(d.values, math.Round(60+math.Sin(t*0.7)*25+math.Sin(t*2.3)*8))
		}
		batch := 1 + int(t/12)
		cmds = append(cmds,
			d.progress.SetState(map[string]any{"value": math.Mod(t/12, 1), "label": fmt.Sprintf("Settling batch %d", batch)}),
			d.spark.SetState(map[string]any{"values": d.values, "label": "Payments / min"}),
			d.ticker.SetState(map[string]any{"items": []map[string]any{
				{"label": "VOLUME", "value": 1_200_000 + int(t*1500), "delta": math.Sin(t*0.4) * 3},
				{"label": "AUTH RATE", "value": 98 + float64(int(t)%10)/10, "delta": -0.2},
				{"label": "PAYOUTS", "value": 420 + int(t)/3, "delta": 3.4},
			}}),
			feed())
		if d.party != nil && time.Since(d.partyAt) > 3*time.Second {
			d.party = nil
		}
	}
	var cmd tea.Cmd
	d.progress, cmd = d.progress.Update(msg)
	cmds = append(cmds, cmd)
	d.spark, cmd = d.spark.Update(msg)
	cmds = append(cmds, cmd)
	d.ticker, cmd = d.ticker.Update(msg)
	cmds = append(cmds, cmd)
	if d.party != nil {
		p, cmd := d.party.Update(msg)
		d.party = &p
		cmds = append(cmds, cmd)
	}
	return d, tea.Batch(cmds...)
}

func (d dash) View() tea.View {
	panel := func(title, body string) string {
		return lipgloss.NewStyle().Border(lipgloss.RoundedBorder()).Padding(0, 1).Render(lipgloss.JoinVertical(lipgloss.Left, lipgloss.NewStyle().Bold(true).Render(title), body))
	}
	head := lipgloss.NewStyle().Faint(true).Render("Payments console · c celebrate · q quit")
	mid := lipgloss.JoinHorizontal(lipgloss.Top, panel("batch", "\n"+d.progress.View()+"\n\n\n"), panel("throughput", d.spark.View()))
	body := lipgloss.JoinVertical(lipgloss.Center, head, "", mid, panel("live", d.ticker.View()))
	view := lipgloss.Place(d.w, d.h, lipgloss.Center, lipgloss.Center, body)
	if d.party != nil {
		view = asciiart.Overlay(view, panel("", d.party.View()), max(0, (d.w-44)/2), max(0, (d.h-15)/2))
	}
	v := tea.NewView(view)
	v.AltScreen = true
	return v
}

func main() {
	spec := mark
	if len(os.Args) > 1 {
		b, err := os.ReadFile(os.Args[1])
		if err != nil {
			fmt.Fprintln(os.Stderr, err)
			os.Exit(1)
		}
		spec = b
	}
	logo := must(asciiart.FromSpec(string(spec)))
	splash := intro.New(logo, newDash(), intro.Fit(asciiart.FitCenter),
		intro.FadeIn(150*time.Millisecond), intro.Hold(3200*time.Millisecond), intro.Hint("press any key"),
		intro.Into(asciiart.Dissolve, 900*time.Millisecond))
	if _, err := tea.NewProgram(splash).Run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
