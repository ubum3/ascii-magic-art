package asciiart

import (
	"math"
	"strconv"
	"strings"
)

// Fit is how the art fills its width x height.
type Fit int

const (
	// FitCenter draws at actual size, placed by Align, cropped if too big.
	FitCenter Fit = iota
	// FitCover scales to fill edge to edge, cropping one axis (like CSS cover).
	FitCover
	// FitContain scales to fit inside, the whole piece visible.
	FitContain
	// FitStretch scales to the size on both axes, ignoring the aspect ratio.
	FitStretch
	// FitTile draws at actual size, repeated.
	FitTile
)

func (f Fit) String() string {
	return [...]string{"center", "cover", "contain", "stretch", "tile"}[f]
}

// Align is where the art sits when it doesn't fill the size exactly.
type Align int

const (
	AlignCenter Align = iota
	AlignTopLeft
	AlignTop
	AlignTopRight
	AlignLeft
	AlignRight
	AlignBottomLeft
	AlignBottom
	AlignBottomRight
)

func (a Align) factors() (float64, float64) {
	x, y := 0.5, 0.5
	switch a {
	case AlignTopLeft, AlignLeft, AlignBottomLeft:
		x = 0
	case AlignTopRight, AlignRight, AlignBottomRight:
		x = 1
	}
	switch a {
	case AlignTopLeft, AlignTop, AlignTopRight:
		y = 0
	case AlignBottomLeft, AlignBottom, AlignBottomRight:
		y = 1
	}
	return x, y
}

// Style is how a frame is drawn into a string.
type Style struct {
	// Width and Height of the output. Zero uses the frame's own size.
	Width, Height int
	Fit           Fit
	Align         Align
	// Dim blends the art toward BG (or black): 0 is full strength, 1 is gone.
	Dim float64
	// BG, when set, is painted behind the whole area.
	BG *RGB
	// Ink is the colour of uncoloured cells when dimming. Default light grey.
	Ink *RGB
	// Mono draws every cell in one colour.
	Mono *RGB
}

var defaultInk = RGB{204, 204, 204}

// pixel levels of the lower block characters photo pieces are drawn in.
var levels = map[rune]float64{'▁': 0.14, '▂': 0.26, '▃': 0.38, '▄': 0.51, '▅': 0.64, '▆': 0.76, '▇': 0.88, '█': 1, ' ': 0}

func pixel(f *Frame, x, y int) RGB {
	c := f.At(x, y)
	if !c.HasFG {
		return RGB{}
	}
	lv, ok := levels[c.Ch]
	if !ok {
		lv = 0.8
	}
	return c.FG.Scale(math.Min(1, lv*1.25))
}

// Render draws a frame as a string of lines with 24-bit colour escapes. Bubble Tea
// brings the colours down to what the terminal supports, and drops them for NO_COLOR.
func Render(f *Frame, s Style) string {
	vw, vh := float64(f.Cols), float64(f.TermRows())
	w, h := s.Width, s.Height
	if w <= 0 {
		w = f.Cols
	}
	if h <= 0 {
		h = f.TermRows()
	}
	if vw == 0 || vh == 0 || w == 0 || h == 0 {
		return strings.TrimSuffix(strings.Repeat(strings.Repeat(" ", w)+"\n", h), "\n")
	}
	kx, ky := 1.0, 1.0
	switch s.Fit {
	case FitCover:
		kx = math.Max(float64(w)/vw, float64(h)/vh)
		ky = kx
	case FitContain:
		kx = math.Min(float64(w)/vw, float64(h)/vh)
		ky = kx
	case FitStretch:
		kx, ky = float64(w)/vw, float64(h)/vh
	}
	ax, ay := s.Align.factors()
	ox, oy := 0.0, 0.0
	if s.Fit != FitTile {
		// Whole cells, rounding toward the top-left when a crop doesn't split evenly.
		ox, oy = math.Ceil((float64(w)-vw*kx)*ax), math.Ceil((float64(h)-vh*ky)*ay)
	}
	base := RGB{}
	if s.BG != nil {
		base = *s.BG
	}
	ink := defaultInk
	if s.Ink != nil {
		ink = *s.Ink
	}
	paint := func(c RGB, has bool) (RGB, bool) {
		if s.Mono != nil {
			c, has = *s.Mono, true
		}
		if s.Dim > 0 {
			if !has {
				c = ink
			}
			return c.Mix(base, s.Dim), true
		}
		return c, has
	}

	var b strings.Builder
	b.Grow(w * h * 4)
	for ty := 0; ty < h; ty++ {
		if ty > 0 {
			b.WriteByte('\n')
		}
		var e escaper
		e.b = &b
		for tx := 0; tx < w; tx++ {
			sx := int(math.Floor((float64(tx) + 0.5 - ox) / kx))
			sy := int(math.Floor((float64(ty) + 0.5 - oy) / ky))
			if s.Fit == FitTile {
				sx, sy = ((sx%f.Cols)+f.Cols)%f.Cols, ((sy%int(vh))+int(vh))%int(vh)
			}
			if sx < 0 || sy < 0 || sx >= f.Cols || sy >= int(vh) {
				e.cell(' ', RGB{}, false, base, s.BG != nil)
				continue
			}
			if f.Square {
				top, _ := paint(pixel(f, sx, 2*sy), true)
				bot, _ := paint(pixel(f, sx, 2*sy+1), true)
				e.cell('▀', top, true, bot, true)
				continue
			}
			c := f.At(sx, sy)
			fg, has := paint(c.FG, c.HasFG)
			e.cell(c.Ch, fg, has, base, s.BG != nil)
		}
		e.end()
	}
	return b.String()
}

// escaper writes cells, emitting colour escapes only when the colour changes.
type escaper struct {
	b            *strings.Builder
	fg, bg       RGB
	hasFG, hasBG bool
	dirty        bool
}

func (e *escaper) cell(ch rune, fg RGB, hasFG bool, bg RGB, hasBG bool) {
	if !e.dirty || hasFG != e.hasFG || (hasFG && fg != e.fg) {
		if hasFG {
			sgr(e.b, 38, fg)
		} else if e.dirty {
			e.b.WriteString("\x1b[39m")
		}
		e.fg, e.hasFG = fg, hasFG
	}
	if !e.dirty || hasBG != e.hasBG || (hasBG && bg != e.bg) {
		if hasBG {
			sgr(e.b, 48, bg)
		} else if e.dirty {
			e.b.WriteString("\x1b[49m")
		}
		e.bg, e.hasBG = bg, hasBG
	}
	e.dirty = true
	e.b.WriteRune(ch)
}

func (e *escaper) end() {
	if e.hasFG || e.hasBG {
		e.b.WriteString("\x1b[m")
	}
}

func sgr(b *strings.Builder, n int, c RGB) {
	b.WriteString("\x1b[")
	b.WriteString(strconv.Itoa(n))
	b.WriteString(";2;")
	b.WriteString(strconv.Itoa(int(c.R)))
	b.WriteByte(';')
	b.WriteString(strconv.Itoa(int(c.G)))
	b.WriteByte(';')
	b.WriteString(strconv.Itoa(int(c.B)))
	b.WriteByte('m')
}
