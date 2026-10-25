package asciiart

import "math"

// BoxStyle picks the corner and edge characters of Grid.Box.
type BoxStyle int

const (
	BoxLight BoxStyle = iota
	BoxHeavy
	BoxDouble
	BoxRound
	BoxASCII
)

// Top-left, top-right, bottom-left, bottom-right, horizontal, vertical.
var boxChars = map[BoxStyle][6]rune{
	BoxLight:  {'┌', '┐', '└', '┘', '─', '│'},
	BoxHeavy:  {'┏', '┓', '┗', '┛', '━', '┃'},
	BoxDouble: {'╔', '╗', '╚', '╝', '═', '║'},
	BoxRound:  {'╭', '╮', '╰', '╯', '─', '│'},
	BoxASCII:  {'+', '+', '+', '+', '-', '|'},
}

// NoKey leaves a cell's colour key as it is.
const NoKey rune = 0

// Grid is the drawing surface for your own pieces, a port of the core of lib/kit.js.
// Each cell holds a character and a palette key (a space is the default ink).
// Anything drawn outside the grid is clipped.
type Grid struct {
	Cols, Rows int
	ch, co     []rune
}

// NewGrid makes a blank grid.
func NewGrid(cols, rows int) *Grid {
	g := &Grid{Cols: cols, Rows: rows, ch: make([]rune, cols*rows), co: make([]rune, cols*rows)}
	return g.Clear()
}

func (g *Grid) index(x, y int) int {
	if x < 0 || y < 0 || x >= g.Cols || y >= g.Rows {
		return -1
	}
	return x + y*g.Cols
}

// Clear blanks every cell.
func (g *Grid) Clear() *Grid {
	for i := range g.ch {
		g.ch[i], g.co[i] = ' ', ' '
	}
	return g
}

// Set puts a character, and a colour key unless key is NoKey.
func (g *Grid) Set(x, y int, ch, key rune) {
	if i := g.index(x, y); i >= 0 {
		g.ch[i] = ch
		if key != NoKey {
			g.co[i] = key
		}
	}
}

// Get is the character at x, y (a space outside).
func (g *Grid) Get(x, y int) rune {
	if i := g.index(x, y); i >= 0 {
		return g.ch[i]
	}
	return ' '
}

// Text writes a string left to right.
func (g *Grid) Text(x, y int, s string, key rune) {
	i := 0
	for _, ch := range s {
		g.Set(x+i, y, ch, key)
		i++
	}
}

// Block writes a multi-line block. Spaces are transparent unless solid.
func (g *Grid) Block(x, y int, s string, key rune, solid bool) {
	r, i := 0, 0
	for _, ch := range s {
		if ch == '\n' {
			r, i = r+1, 0
			continue
		}
		if solid || ch != ' ' {
			g.Set(x+i, y+r, ch, key)
		}
		i++
	}
}

// HLine draws a horizontal line from x0 to x1.
func (g *Grid) HLine(x0, x1, y int, ch, key rune) {
	for x := min(x0, x1); x <= max(x0, x1); x++ {
		g.Set(x, y, ch, key)
	}
}

// VLine draws a vertical line from y0 to y1.
func (g *Grid) VLine(x, y0, y1 int, ch, key rune) {
	for y := min(y0, y1); y <= max(y0, y1); y++ {
		g.Set(x, y, ch, key)
	}
}

// Box draws an outline, w x h cells including the border.
func (g *Grid) Box(x, y, w, h int, style BoxStyle, key rune) {
	c := boxChars[style]
	g.HLine(x+1, x+w-2, y, c[4], key)
	g.HLine(x+1, x+w-2, y+h-1, c[4], key)
	g.VLine(x, y+1, y+h-2, c[5], key)
	g.VLine(x+w-1, y+1, y+h-2, c[5], key)
	g.Set(x, y, c[0], key)
	g.Set(x+w-1, y, c[1], key)
	g.Set(x, y+h-1, c[2], key)
	g.Set(x+w-1, y+h-1, c[3], key)
}

// Fill fills a rectangle.
func (g *Grid) Fill(x, y, w, h int, ch, key rune) {
	for j := 0; j < h; j++ {
		for i := 0; i < w; i++ {
			g.Set(x+i, y+j, ch, key)
		}
	}
}

// Line draws a Bresenham line.
func (g *Grid) Line(x0, y0, x1, y1 float64, ch, key rune) {
	ax, ay, bx, by := int(math.Round(x0)), int(math.Round(y0)), int(math.Round(x1)), int(math.Round(y1))
	dx, dy := abs(bx-ax), -abs(by-ay)
	sx, sy := 1, 1
	if ax >= bx {
		sx = -1
	}
	if ay >= by {
		sy = -1
	}
	e := dx + dy
	for n := 0; n < 4000; n++ {
		g.Set(ax, ay, ch, key)
		if ax == bx && ay == by {
			break
		}
		e2 := 2 * e
		if e2 >= dy {
			e += dy
			ax += sx
		}
		if e2 <= dx {
			e += dx
			ay += sy
		}
	}
}

// Circle draws an ellipse outline, squashed by aspect (0.5 looks round in tall terminal cells).
func (g *Grid) Circle(cx, cy, r float64, ch, key rune, aspect float64) {
	n := int(math.Max(12, math.Ceil(r*8)))
	for i := 0; i < n; i++ {
		a := float64(i) / float64(n) * 2 * math.Pi
		g.Set(int(math.Round(cx+math.Cos(a)*r)), int(math.Round(cy+math.Sin(a)*r*aspect)), ch, key)
	}
}

// Shade calls fn(x, y, u, v) for every cell, u and v in 0..1, and draws what it returns
// unless ok is false.
func (g *Grid) Shade(fn func(x, y int, u, v float64) (ch, key rune, ok bool)) {
	w, h := math.Max(1, float64(g.Cols-1)), math.Max(1, float64(g.Rows-1))
	for y := 0; y < g.Rows; y++ {
		for x := 0; x < g.Cols; x++ {
			if ch, key, ok := fn(x, y, float64(x)/w, float64(y)/h); ok {
				g.Set(x, y, ch, key)
			}
		}
	}
}

// Frame is the finished frame, with keys resolved through the palette.
func (g *Grid) Frame(p *Palette) Frame {
	f := Frame{Cols: g.Cols, Rows: g.Rows, Cells: make([]Cell, len(g.ch))}
	for i, ch := range g.ch {
		c := Cell{Ch: ch}
		c.FG, c.HasFG = p.Get(g.co[i])
		f.Cells[i] = c
	}
	return f
}

func abs(v int) int {
	if v < 0 {
		return -v
	}
	return v
}
