package asciiart

import (
	"encoding/json"
	"math"
)

// Meta is what a piece is: its name, size, frame rate and colours.
type Meta struct {
	Slug, Name, Category, Note string
	Tags                       []string
	Cols, Rows                 int
	FPS                        float64
	// Square marks photo-style pieces, drawn with half blocks.
	Square  bool
	Palette Palette
	// Clock is true when the piece reads the time of day, so it isn't a pure function of t.
	Clock bool
}

// NewMeta is meta for your own piece: named after its slug, category "custom", 24 fps.
func NewMeta(slug string, cols, rows int) Meta {
	return Meta{Slug: slug, Name: slug, Category: "custom", Cols: cols, Rows: rows, FPS: 24}
}

// Piece is anything that draws frames over time. Library pieces are *JSPiece;
// implement it for your own, usually with a Grid.
//
// Keep Draw a function of t alone where you can: the player skips frames,
// seeks, and starts part-way through.
type Piece interface {
	Meta() Meta
	// Draw returns the frame at t seconds, exactly Meta().Cols x Meta().Rows.
	Draw(t float64) Frame
}

// Looker is a piece that can be redrawn in a look. *JSPiece is one.
type Looker interface {
	SetLook(Look) error
}

// LookName is one of the looks every library piece can be redrawn in.
type LookName string

const (
	Original LookName = "original"
	Dots     LookName = "dots"
	ASCII    LookName = "ascii"
	Dense    LookName = "dense"
	Numbers  LookName = "numbers"
	Binary   LookName = "binary"
	Letters  LookName = "letters"
	Blocks   LookName = "blocks"
	Squares  LookName = "squares"
	Lines    LookName = "lines"
	Dither   LookName = "dither"
)

// Looks is every look, in the order the CLI cycles through them.
var Looks = []LookName{Original, Dots, ASCII, Dense, Numbers, Binary, Letters, Blocks, Squares, Lines, Dither}

// Next is the next look, wrapping around.
func (l LookName) Next() LookName {
	for i, x := range Looks {
		if x == l {
			return Looks[(i+1)%len(Looks)]
		}
	}
	return Looks[0]
}

// Look is a look plus its settings, the same options as the <ascii-art> attributes.
// Looks apply to library pieces; your own pieces draw as they are.
// The zero value is the original look.
type Look struct {
	Look LookName
	// Chars are your own characters instead of a look, e.g. " .oO@" (sorted light to dark for you).
	Chars string
	// Mono draws in one colour (the default ink) instead of the palette.
	Mono bool
	// All redraws text and line work too, not only shading.
	All bool
	// Contrast is 0 to 100. Nil means the default (0).
	Contrast *float64
	// DotSize is the halftone dot size for the dots look, 25 to 120 (default 51).
	DotSize *float64
	// Density is the halftone dot spacing, 40 to 250 (default 131).
	Density *float64
	// Steps is halftone dot sizes: 3, 5, or 0 for smooth.
	Steps *int
}

// LookOf is a look with default settings.
func LookOf(name LookName) Look { return Look{Look: name} }

// IsOriginal is true when the piece draws as it is.
func (l Look) IsOriginal() bool {
	return (l.Look == "" || l.Look == Original) && l.Chars == "" && !l.Mono
}

// json is the runtime's look options, with the same mapping as runtime/ascii.js.
func (l Look) json() string {
	if l.IsOriginal() {
		return ""
	}
	o := map[string]any{}
	if l.Look != "" && l.Look != Original {
		o["look"] = string(l.Look)
	}
	if l.Chars != "" {
		o["chars"] = l.Chars
	}
	if l.Mono {
		o["mono"] = true
	}
	if l.All {
		o["all"] = true
	}
	if l.Contrast != nil {
		o["gamma"] = 0.35 + *l.Contrast/100*0.8
	}
	if l.DotSize != nil {
		o["size"] = *l.DotSize / 100
	}
	if l.Density != nil {
		o["density"] = *l.Density / 100
	}
	if l.Steps != nil {
		o["steps"] = *l.Steps
	}
	b, _ := json.Marshal(o)
	return string(b)
}

// Ramps are character ramps, light to dark, as in lib/kit.js.
var Ramps = struct{ Classic, Fine, Dots, Blocks, Soft, Lines string }{
	Classic: " .:-=+*#%@",
	Fine:    " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$",
	Dots:    " .·•●",
	Blocks:  " ░▒▓█",
	Soft:    " .,-~:;=!*#$@",
	Lines:   " -=≡",
}

// Ramp maps 0..1 to a character of a ramp: Ramp(0.5, Ramps.Classic).
func Ramp(v float64, chars string) rune {
	r := []rune(chars)
	if len(r) == 0 {
		return ' '
	}
	i := int(math.Max(0, math.Floor(v*float64(len(r)))))
	return r[min(i, len(r)-1)]
}
