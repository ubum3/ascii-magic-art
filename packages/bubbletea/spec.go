package asciiart

import (
	"encoding/json"
	"fmt"
	"image"
	"math"
)

// Spec is a piece made from data: an extras spec, the JSON a JS kind in
// packages/extras draws (a logo, text, a progress bar, a sparkline, a ticker, a
// celebration or a picture). Build one here, or with the ama-studio CLI
// (`ama-studio brand logo.svg -o logo.json`), and play it with Model or FromSpec.
//
//	deployed, _ := asciiart.TextSpec("DEPLOYED").Effect(asciiart.Scramble).Model()
//	bar, _ := asciiart.ProgressSpec(40).With("label", "Uploading").Model()
//	cmd := bar.SetState(map[string]any{"value": 0.42})
type Spec map[string]any

// TextEffect is an entrance for text.
type TextEffect string

const (
	Typewriter TextEffect = "typewriter"
	Wave       TextEffect = "wave"
	Rainbow    TextEffect = "rainbow"
	Scramble   TextEffect = "scramble"
	Glitch     TextEffect = "glitch"
	PlainText  TextEffect = "plain"
)

// BrandEffect is an entrance for a logo.
type BrandEffect string

const (
	Reveal   BrandEffect = "reveal"
	Draw     BrandEffect = "draw"
	Assemble BrandEffect = "assemble"
	Matrix   BrandEffect = "matrix"
	Glitchy  BrandEffect = "glitch"
	Halftone BrandEffect = "halftone"
	Spin3D   BrandEffect = "spin3d"
	Shimmer  BrandEffect = "shimmer"
)

// Celebration is how a celebrate spec looks.
type Celebration string

const (
	Check     Celebration = "check"
	Confetti  Celebration = "confetti"
	Fireworks Celebration = "fireworks"
)

// ParseSpec reads a spec's JSON, such as a file ama-studio wrote.
func ParseSpec(data []byte) (Spec, error) {
	var s Spec
	if err := json.Unmarshal(data, &s); err != nil {
		return nil, err
	}
	if _, ok := s["kind"].(string); !ok {
		return nil, fmt.Errorf("asciiart: a spec is a JSON object with a \"kind\"")
	}
	return s, nil
}

// TextSpec is words in a 5-row block font. The default effect is scramble.
func TextSpec(text string) Spec { return Spec{"kind": "text", "text": text} }

// ProgressSpec is a progress bar cols wide. State: {"value": 0..1, "label": "..."}.
func ProgressSpec(cols int) Spec { return Spec{"kind": "progress", "cols": cols} }

// SparklineSpec is a sparkline. State: {"values": [...], "label": "..."}.
func SparklineSpec(cols, rows int) Spec {
	return Spec{"kind": "sparkline", "cols": cols, "rows": rows}
}

// TickerSpec is a scrolling ticker. State: {"items": [{"label": "VOL", "value": 12, "delta": 1.5}]}.
func TickerSpec(cols int) Spec { return Spec{"kind": "ticker", "cols": cols} }

// CelebrateSpec is a check that draws itself, confetti or fireworks over a message.
func CelebrateSpec(message string, style Celebration) Spec {
	return Spec{"kind": "celebrate", "message": message, "style": string(style)}
}

// ImageSpec is a picture from any image (decode it with image/png, image/jpeg...),
// scaled to cols wide. Square cells draw two per terminal cell with half blocks.
func ImageSpec(img image.Image, cols int, square bool) (Spec, error) {
	b := img.Bounds()
	if b.Dx() == 0 || b.Dy() == 0 || cols <= 0 {
		return nil, fmt.Errorf("asciiart: empty image")
	}
	aspect := 1.0
	if !square {
		aspect = 1 / 0.602
	}
	rows := max(1, int(math.Round(float64(b.Dy())/float64(b.Dx())*float64(cols)/aspect)))
	js, err := ImageSpecFromRGBA(downscale(img, cols, rows), cols, rows, fmt.Sprintf(`{"square":%t}`, square))
	if err != nil {
		return nil, err
	}
	return ParseSpec([]byte(js))
}

// downscale averages the source pixels under each target pixel (a box filter).
func downscale(img image.Image, w, h int) []byte {
	b := img.Bounds()
	out := make([]byte, w*h*4)
	for y := 0; y < h; y++ {
		y0, y1 := b.Min.Y+y*b.Dy()/h, b.Min.Y+max((y+1)*b.Dy()/h, y*b.Dy()/h+1)
		for x := 0; x < w; x++ {
			x0, x1 := b.Min.X+x*b.Dx()/w, b.Min.X+max((x+1)*b.Dx()/w, x*b.Dx()/w+1)
			var r, g, bl, a, n uint64
			for sy := y0; sy < y1; sy++ {
				for sx := x0; sx < x1; sx++ {
					cr, cg, cb, ca := img.At(sx, sy).RGBA()
					r, g, bl, a, n = r+uint64(cr), g+uint64(cg), bl+uint64(cb), a+uint64(ca), n+1
				}
			}
			i := (y*w + x) * 4
			// RGBA() is premultiplied; undo it so the hue survives.
			if a > 0 {
				out[i], out[i+1], out[i+2] = byte(r*255/a), byte(g*255/a), byte(bl*255/a)
			}
			out[i+3] = byte(a / n >> 8)
		}
	}
	return out
}

// With sets any field the kind reads, and returns the spec.
func (s Spec) With(key string, v any) Spec { s[key] = v; return s }

// Effect sets a text entrance.
func (s Spec) Effect(e TextEffect) Spec { return s.With("effect", string(e)) }

// BrandEffect sets a logo entrance.
func (s Spec) BrandEffect(e BrandEffect) Spec { return s.With("effect", string(e)) }

// Colors sets hex colours: for text, main, accent and shadow.
func (s Spec) Colors(hex ...string) Spec { return s.With("colors", hex) }

// Duration sets how many seconds the entrance takes.
func (s Spec) Duration(seconds float64) Spec { return s.With("duration", seconds) }

// Loop replays it every n seconds.
func (s Spec) Loop(seconds float64) Spec { return s.With("loop", seconds) }

// JSON is the spec as JSON.
func (s Spec) JSON() string {
	b, _ := json.Marshal(map[string]any(s))
	return string(b)
}

// Model plays the spec.
func (s Spec) Model(opts ...Option) (Model, error) { return FromSpec(s.JSON(), opts...) }
