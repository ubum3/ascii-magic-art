package asciiart

import (
	"math"
	"strconv"
	"strings"
)

// RGB is a 24-bit colour.
type RGB struct{ R, G, B uint8 }

// Hex parses "#rrggbb" or "#rgb" (the # is optional).
func Hex(s string) (RGB, bool) {
	s = strings.TrimPrefix(s, "#")
	v := func(a, b int, mul uint64) (uint8, bool) {
		n, err := strconv.ParseUint(s[a:b], 16, 8)
		return uint8(n * mul), err == nil
	}
	var r, g, b uint8
	var ok1, ok2, ok3 bool
	switch len(s) {
	case 6:
		r, ok1 = v(0, 2, 1)
		g, ok2 = v(2, 4, 1)
		b, ok3 = v(4, 6, 1)
	case 3:
		r, ok1 = v(0, 1, 17)
		g, ok2 = v(1, 2, 17)
		b, ok3 = v(2, 3, 17)
	default:
		return RGB{}, false
	}
	return RGB{r, g, b}, ok1 && ok2 && ok3
}

// MustHex is Hex that panics on a bad string, for colour constants.
func MustHex(s string) RGB {
	c, ok := Hex(s)
	if !ok {
		panic("asciiart: bad colour " + strconv.Quote(s))
	}
	return c
}

// Mix blends toward other: 0 keeps c, 1 gives other.
func (c RGB) Mix(other RGB, f float64) RGB {
	f = clamp01(f)
	m := func(a, b uint8) uint8 { return uint8(math.Round(float64(a) + (float64(b)-float64(a))*f)) }
	return RGB{m(c.R, other.R), m(c.G, other.G), m(c.B, other.B)}
}

// Scale multiplies every channel by f (0 to 1).
func (c RGB) Scale(f float64) RGB {
	f = clamp01(f)
	s := func(a uint8) uint8 { return uint8(math.Round(float64(a) * f)) }
	return RGB{s(c.R), s(c.G), s(c.B)}
}

func clamp01(f float64) float64 { return math.Max(0, math.Min(1, f)) }

// Keys are the palette keys Palette hands out, in order: 0-9, a-z, A-Z.
const Keys = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"

// Palette maps single ASCII keys to colours. A space means the default ink.
type Palette struct {
	set  [128]bool
	keys [128]RGB
}

// NewPalette puts colours under the keys 0, 1, ... 9, a, ... like palette() in lib/kit.js.
// Bad hex strings are skipped.
func NewPalette(hexes ...string) Palette {
	var p Palette
	for i, h := range hexes {
		if i >= len(Keys) {
			break
		}
		if c, ok := Hex(h); ok {
			p.Set(rune(Keys[i]), c)
		}
	}
	return p
}

// Set puts a colour under a key. Non-ASCII keys and space are ignored.
func (p *Palette) Set(key rune, c RGB) {
	if key > 0 && key < 128 && key != ' ' {
		p.set[key], p.keys[key] = true, c
	}
}

// Get returns the colour under a key.
func (p *Palette) Get(key rune) (RGB, bool) {
	if key > 0 && key < 128 && p.set[key] {
		return p.keys[key], true
	}
	return RGB{}, false
}

func paletteFromMap(m map[string]string) Palette {
	var p Palette
	for k, h := range m {
		if c, ok := Hex(h); ok && k != "" {
			p.Set(rune(k[0]), c)
		}
	}
	return p
}

// Cell is one character and its colour. HasFG false means the default ink.
type Cell struct {
	Ch    rune
	FG    RGB
	HasFG bool
}

var blank = Cell{Ch: ' '}

// Frame is one frame of a piece, exactly Cols x Rows cells, row-major.
type Frame struct {
	Cols, Rows int
	// Square marks photo-style pieces: one pixel per cell, drawn two to a
	// terminal cell with the ▀ half block.
	Square bool
	Cells  []Cell
}

// BlankFrame is an empty frame of a size.
func BlankFrame(cols, rows int) Frame {
	f := Frame{Cols: cols, Rows: rows, Cells: make([]Cell, cols*rows)}
	for i := range f.Cells {
		f.Cells[i] = blank
	}
	return f
}

// FrameFromLayers builds a frame from a piece's text and colour layers, the shape
// draw(t) returns in JS. Rows are padded or cut so the frame is always cols x rows.
// An empty color means no colour layer.
func FrameFromLayers(text, color string, p *Palette, cols, rows int) Frame {
	f := BlankFrame(cols, rows)
	var crows []string
	if color != "" {
		crows = strings.Split(color, "\n")
	}
	for y, line := range strings.SplitN(text, "\n", rows+1) {
		if y >= rows {
			break
		}
		var keys []rune
		if y < len(crows) {
			keys = []rune(crows[y])
		}
		x := 0
		for _, ch := range line {
			if x >= cols {
				break
			}
			c := Cell{Ch: ch}
			if x < len(keys) {
				c.FG, c.HasFG = p.Get(keys[x])
			}
			f.Cells[y*cols+x] = c
			x++
		}
	}
	return f
}

// At returns the cell at x, y, or a blank one outside the frame.
func (f *Frame) At(x, y int) Cell {
	if x < 0 || y < 0 || x >= f.Cols || y >= f.Rows {
		return blank
	}
	return f.Cells[y*f.Cols+x]
}

// Text is the characters only, as lines joined by \n.
func (f *Frame) Text() string {
	var b strings.Builder
	for y := 0; y < f.Rows; y++ {
		if y > 0 {
			b.WriteByte('\n')
		}
		for x := 0; x < f.Cols; x++ {
			b.WriteRune(f.Cells[y*f.Cols+x].Ch)
		}
	}
	return b.String()
}

// TermRows is how many terminal rows the frame takes: square pieces pack two pixel rows into one.
func (f *Frame) TermRows() int {
	if f.Square {
		return (f.Rows + 1) / 2
	}
	return f.Rows
}
