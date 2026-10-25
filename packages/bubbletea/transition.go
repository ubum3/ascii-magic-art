package asciiart

import (
	"math"
	"strings"
	"unicode/utf8"

	"github.com/mattn/go-runewidth"
)

// TransitionKind is how one screen turns into another.
type TransitionKind int

const (
	// Dissolve switches cells over one by one, in a scattered order.
	Dissolve TransitionKind = iota
	// WipeRight, WipeLeft, WipeDown and WipeUp slide the new screen in behind a bright edge.
	WipeRight
	WipeLeft
	WipeDown
	WipeUp
	// Melt drips the old screen's columns down and away.
	Melt
	// ScrambleIn flickers cells through random glyphs before they settle.
	ScrambleIn
	// Iris opens a circle from the centre.
	Iris
)

// Transitions is every kind, for cycling through them.
var Transitions = []TransitionKind{Dissolve, WipeRight, WipeLeft, WipeDown, WipeUp, Melt, ScrambleIn, Iris}

func (k TransitionKind) String() string {
	return [...]string{"dissolve", "wipe-right", "wipe-left", "wipe-down", "wipe-up", "melt", "scramble", "iris"}[k]
}

// A screen cell parsed from a view string: its text and the SGR codes in force.
type tcell struct {
	s   string // "" for the right half of a wide character
	sgr string
}

// cells parses a view (text with SGR colour codes, lines split on \n) into a w x h grid.
func cells(view string, w, h int) [][]tcell {
	g := make([][]tcell, h)
	lines := strings.Split(view, "\n")
	for y := range g {
		g[y] = make([]tcell, w)
		for x := range g[y] {
			g[y][x].s = " "
		}
		if y >= len(lines) {
			continue
		}
		x, sgr, line := 0, "", lines[y]
		for i := 0; i < len(line) && x < w; {
			if line[i] == 0x1b && i+1 < len(line) && line[i+1] == '[' {
				j := i + 2
				for j < len(line) && (line[j] < 0x40 || line[j] > 0x7e) {
					j++
				}
				if j < len(line) && line[j] == 'm' {
					seq := line[i : j+1]
					if seq == "\x1b[m" || seq == "\x1b[0m" {
						sgr = ""
					} else {
						sgr += seq
					}
				}
				i = j + 1
				continue
			}
			r, size := utf8.DecodeRuneInString(line[i:])
			i += size
			if r == '\r' {
				continue
			}
			g[y][x] = tcell{string(r), sgr}
			x++
			if runewidth.RuneWidth(r) == 2 && x < w {
				g[y][x] = tcell{"", sgr}
				x++
			}
		}
	}
	return g
}

func render(g [][]tcell) string {
	var b strings.Builder
	for y, row := range g {
		if y > 0 {
			b.WriteString("\x1b[m\n")
		}
		cur := ""
		for _, c := range row {
			if c.sgr != cur {
				b.WriteString("\x1b[m")
				b.WriteString(c.sgr)
				cur = c.sgr
			}
			b.WriteString(c.s)
		}
	}
	b.WriteString("\x1b[m")
	return b.String()
}

func hash3(x, y, n uint32) float64 {
	h := x*374761393 + y*668265263 + n*2147483647
	h = (h ^ (h >> 13)) * 1274126177
	return float64(h^(h>>16)) / 4294967296
}

func smoothstep(t float64) float64 {
	t = clamp01(t)
	return t * t * (3 - 2*t)
}

var noise = []rune("!<>-_/[]{}=+*^?#%&$@")

// Transition mixes two views of w x h cells at p (0 is all from, 1 all to) and
// returns the view to show. Both views are any rendered strings: a Model's View,
// your app's View content, lipgloss output.
func Transition(kind TransitionKind, from, to string, w, h int, p float64) string {
	if p <= 0 {
		return from
	}
	if p >= 1 {
		return to
	}
	a, z := cells(from, w, h), cells(to, w, h)
	out := make([][]tcell, h)
	fw, fh := float64(w), float64(h)
	for y := 0; y < h; y++ {
		out[y] = make([]tcell, w)
		for x := 0; x < w; x++ {
			fx, fy := float64(x)+0.5, float64(y)+0.5
			c := a[y][x]
			switch kind {
			case WipeRight, WipeLeft, WipeDown, WipeUp:
				u, n := fx, fw
				switch kind {
				case WipeLeft:
					u = fw - fx
				case WipeDown:
					u, n = fy, fh
				case WipeUp:
					u, n = fh-fy, fh
				}
				front := smoothstep(p)*(n+2) - 1
				if u < front-1 {
					c = z[y][x]
				} else if u < front {
					c = tcell{"█", z[y][x].sgr}
				}
			case Dissolve:
				if hash3(uint32(x), uint32(y), 7) < smoothstep(p) {
					c = z[y][x]
				}
			case ScrambleIn:
				k, q := hash3(uint32(x), uint32(y), 3), smoothstep(p)*1.3
				if k < q-0.3 {
					c = z[y][x]
				} else if k < q {
					n := uint32(p * 30)
					c = tcell{string(noise[int(hash3(uint32(x), uint32(y), n)*float64(len(noise)))%len(noise)]), z[y][x].sgr}
				}
			case Melt:
				delay := hash3(uint32(x), 0, 11) * 0.35
				k := clamp01((p - delay) / 0.65)
				sy := y - int(math.Floor(k*k*(fh+2)))
				if sy >= 0 {
					c = a[sy][x]
				} else {
					c = z[y][x]
				}
			case Iris:
				dx, dy := fx-fw/2, (fy-fh/2)/0.602
				r := smoothstep(p) * (math.Hypot(fw/2, fh/2/0.602) + 1)
				if math.Hypot(dx, dy) < r {
					c = z[y][x]
				}
			}
			out[y][x] = c
		}
	}
	// A wide character cut in half by the mix shows as a space.
	for y := range out {
		for x := range out[y] {
			if out[y][x].s == "" && (x == 0 || runewidth.StringWidth(out[y][x-1].s) != 2) {
				out[y][x].s = " "
			}
		}
	}
	return render(out)
}
