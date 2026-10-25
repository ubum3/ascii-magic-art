package asciiart

import (
	"bytes"
	"compress/flate"
	_ "embed"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"sync"

	"github.com/dop251/goja"
)

// Made by scripts/bundle-native.mjs: "AMA1", u32 LE index length, JSON index, deflate blobs.
//
//go:embed pieces.bin
var bundle []byte

type rawPiece struct {
	Slug     string            `json:"slug"`
	Name     string            `json:"name"`
	Category string            `json:"category"`
	Note     string            `json:"note"`
	Tags     []string          `json:"tags"`
	Cols     int               `json:"cols"`
	Rows     int               `json:"rows"`
	FPS      float64           `json:"fps"`
	Square   bool              `json:"square"`
	Palette  map[string]string `json:"palette"`
	Clock    bool              `json:"clock"`
	Off      int               `json:"off"`
	Len      int               `json:"len"`
}

type asset struct {
	metas   []Meta
	blobs   [][2]int
	bySlug  map[string]int
	data    []byte
	prelude *goja.Program
	progs   sync.Map // slug -> *goja.Program
	extras  [2]int
	hasX    bool
	xOnce   sync.Once
	xProg   *goja.Program
	xErr    error
}

var (
	loadOnce sync.Once
	loaded   *asset
)

func lib() *asset {
	loadOnce.Do(func() {
		if len(bundle) < 8 || string(bundle[:4]) != "AMA1" {
			panic("asciiart: pieces.bin is not a piece bundle")
		}
		n := int(binary.LittleEndian.Uint32(bundle[4:8]))
		var idx struct {
			Prelude [2]int     `json:"prelude"`
			Extras  *[2]int    `json:"extras"`
			Pieces  []rawPiece `json:"pieces"`
		}
		if err := json.Unmarshal(bundle[8:8+n], &idx); err != nil {
			panic("asciiart: pieces.bin: bad index: " + err.Error())
		}
		a := &asset{bySlug: map[string]int{}, data: bundle[8+n:]}
		for _, p := range idx.Pieces {
			a.bySlug[p.Slug] = len(a.metas)
			a.blobs = append(a.blobs, [2]int{p.Off, p.Len})
			a.metas = append(a.metas, Meta{
				Slug: p.Slug, Name: p.Name, Category: p.Category, Note: p.Note, Tags: p.Tags,
				Cols: p.Cols, Rows: p.Rows, FPS: p.FPS, Square: p.Square,
				Palette: paletteFromMap(p.Palette), Clock: p.Clock,
			})
		}
		a.prelude = goja.MustCompile("prelude.js", a.inflate(idx.Prelude), false)
		if idx.Extras != nil {
			a.extras, a.hasX = *idx.Extras, true
		}
		loaded = a
	})
	return loaded
}

func (a *asset) inflate(at [2]int) string {
	b, err := io.ReadAll(flate.NewReader(bytes.NewReader(a.data[at[0] : at[0]+at[1]])))
	if err != nil {
		panic("asciiart: pieces.bin: bad blob: " + err.Error())
	}
	return string(b)
}

// Compiled pieces are kept, since goja programs can run in any number of runtimes.
func (a *asset) program(i int) (*goja.Program, error) {
	slug := a.metas[i].Slug
	if p, ok := a.progs.Load(slug); ok {
		return p.(*goja.Program), nil
	}
	p, err := goja.Compile(slug+".js", a.inflate(a.blobs[i]), false)
	if err != nil {
		return nil, err
	}
	a.progs.Store(slug, p)
	return p, nil
}

// The extras script (specs: logos, text, data, pictures), compiled once.
func (a *asset) extrasProgram() (*goja.Program, error) {
	a.xOnce.Do(func() {
		if !a.hasX {
			a.xErr = fmt.Errorf("this pieces.bin has no extras: run `npm run native`")
			return
		}
		a.xProg, a.xErr = goja.Compile("extras.js", a.inflate(a.extras), false)
	})
	return a.xProg, a.xErr
}

// extrasVM is a runtime with the prelude and the extras loaded.
func extrasVM() (*goja.Runtime, *goja.Object, error) {
	a := lib()
	x, err := a.extrasProgram()
	if err != nil {
		return nil, nil, err
	}
	vm := goja.New()
	if _, err := vm.RunProgram(a.prelude); err != nil {
		return nil, nil, err
	}
	if _, err := vm.RunProgram(x); err != nil {
		return nil, nil, err
	}
	return vm, vm.Get("__ama").ToObject(vm), nil
}

// Catalog is every library piece, sorted by slug.
func Catalog() []Meta { return lib().metas }

// MetaOf is one library piece's meta, by slug.
func MetaOf(slug string) (Meta, bool) {
	a := lib()
	i, ok := a.bySlug[slug]
	if !ok {
		return Meta{}, false
	}
	return a.metas[i], true
}

// UnknownPieceError is returned for a slug no library piece has.
type UnknownPieceError struct {
	Slug        string
	Suggestions []string
}

func (e *UnknownPieceError) Error() string {
	if len(e.Suggestions) == 0 {
		return fmt.Sprintf("no piece %q", e.Slug)
	}
	return fmt.Sprintf("no piece %q (did you mean %s?)", e.Slug, strings.Join(e.Suggestions, ", "))
}

// JSError is a piece throwing in the JS engine.
type JSError struct {
	Slug, Message string
}

func (e *JSError) Error() string { return fmt.Sprintf("%q failed: %s", e.Slug, e.Message) }

func unknown(slug string) error {
	type scored struct {
		d int
		s string
	}
	var near []scored
	for _, m := range lib().metas {
		d := levenshtein(slug, m.Slug)
		if strings.Contains(m.Slug, slug) || strings.Contains(slug, m.Slug) {
			d = 0
		}
		if d <= max(2, len(slug)/3) {
			near = append(near, scored{d, m.Slug})
		}
	}
	sort.Slice(near, func(i, j int) bool {
		if near[i].d != near[j].d {
			return near[i].d < near[j].d
		}
		return near[i].s < near[j].s
	})
	e := &UnknownPieceError{Slug: slug}
	for i := 0; i < len(near) && i < 3; i++ {
		e.Suggestions = append(e.Suggestions, near[i].s)
	}
	return e
}

func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i, ca := range ra {
		cur := make([]int, len(rb)+1)
		cur[0] = i + 1
		for j, cb := range rb {
			sub := prev[j]
			if ca != cb {
				sub++
			}
			cur[j+1] = min(sub, prev[j+1]+1, cur[j]+1)
		}
		prev = cur
	}
	return prev[len(rb)]
}

// JSPiece is a library piece running in its own goja runtime. A runtime is not
// safe for concurrent use, so neither is a JSPiece: the Model serialises its draws.
type JSPiece struct {
	meta     Meta
	palette  Palette
	vm       *goja.Runtime
	create   goja.Callable
	draw     goja.Callable
	drop     goja.Callable
	setState goja.Callable
	handle   goja.Value
	// spec is the JSON of a piece made from a spec, so a new look can remake it.
	spec, state string
}

type specMeta struct {
	Slug     string            `json:"slug"`
	Name     string            `json:"name"`
	Category string            `json:"category"`
	Note     string            `json:"note"`
	Tags     []string          `json:"tags"`
	Cols     int               `json:"cols"`
	Rows     int               `json:"rows"`
	FPS      float64           `json:"fps"`
	Cell     string            `json:"cell"`
	Palette  map[string]string `json:"palette"`
}

// NewSpecPiece makes a piece from an extras spec (JSON): a logo from
// `ama-studio brand`, animated text, a progress bar, a picture... See Spec.
func NewSpecPiece(spec string, look Look) (*JSPiece, error) {
	vm, ama, err := extrasVM()
	if err != nil {
		return nil, &JSError{"spec", err.Error()}
	}
	fn := func(name string) goja.Callable { f, _ := goja.AssertFunction(ama.Get(name)); return f }
	p := &JSPiece{vm: vm, create: fn("makeSpec"), draw: fn("draw"), drop: fn("drop"), setState: fn("setState"), spec: spec}
	h, err := p.create(goja.Undefined(), vm.ToValue(spec), vm.ToValue(look.json()))
	if err != nil {
		return nil, &JSError{"spec", err.Error()}
	}
	mv, err := fn("meta")(goja.Undefined(), h)
	if err != nil {
		return nil, &JSError{"spec", err.Error()}
	}
	var m specMeta
	if err := json.Unmarshal([]byte(mv.String()), &m); err != nil {
		return nil, &JSError{"spec", err.Error()}
	}
	p.meta = Meta{
		Slug: m.Slug, Name: m.Name, Category: m.Category, Note: m.Note, Tags: m.Tags,
		Cols: m.Cols, Rows: m.Rows, FPS: m.FPS, Square: m.Cell == "square", Palette: paletteFromMap(m.Palette),
	}
	p.handle, p.palette = h, p.meta.Palette
	return p, nil
}

// SetState gives a data spec (progress, sparkline, ticker, celebrate) its state as
// JSON, such as {"value": 0.4}. Every frame from now on draws it.
func (p *JSPiece) SetState(state string) error {
	if p.setState == nil {
		return nil
	}
	if _, err := p.setState(goja.Undefined(), p.handle, p.vm.ToValue(state)); err != nil {
		return &JSError{p.meta.Slug, err.Error()}
	}
	p.state = state
	return nil
}

// ImageSpecFromRGBA turns RGBA pixels (one per cell, w x h) into an image spec,
// with the same quantiser the studio CLI and the browser use. opts is JSON such as
// {"colors": 48, "square": true, "motion": {"glint": true}}.
func ImageSpecFromRGBA(rgba []byte, w, h int, opts string) (string, error) {
	if len(rgba) != w*h*4 {
		return "", fmt.Errorf("asciiart: %d bytes is not %dx%d RGBA", len(rgba), w, h)
	}
	vm, ama, err := extrasVM()
	if err != nil {
		return "", err
	}
	// One rune per byte: the cheapest way to hand bytes to the engine.
	rs := make([]rune, len(rgba))
	for i, b := range rgba {
		rs[i] = rune(b)
	}
	f, _ := goja.AssertFunction(ama.Get("imageSpec"))
	v, err := f(goja.Undefined(), vm.ToValue(string(rs)), vm.ToValue(w), vm.ToValue(h), vm.ToValue(opts))
	if err != nil {
		return "", &JSError{"image", err.Error()}
	}
	return v.String(), nil
}

// NewJSPiece loads a library piece by slug, drawn in a look (the zero Look is the original).
func NewJSPiece(slug string, look Look) (*JSPiece, error) {
	a := lib()
	i, ok := a.bySlug[slug]
	if !ok {
		return nil, unknown(slug)
	}
	prog, err := a.program(i)
	if err != nil {
		return nil, &JSError{slug, err.Error()}
	}
	vm := goja.New()
	if _, err := vm.RunProgram(a.prelude); err != nil {
		return nil, &JSError{slug, err.Error()}
	}
	if _, err := vm.RunProgram(prog); err != nil {
		return nil, &JSError{slug, err.Error()}
	}
	ama := vm.Get("__ama").ToObject(vm)
	fn := func(name string) goja.Callable { f, _ := goja.AssertFunction(ama.Get(name)); return f }
	p := &JSPiece{meta: a.metas[i], vm: vm, create: fn("make"), draw: fn("draw"), drop: fn("drop")}
	if err := p.SetLook(look); err != nil {
		return nil, err
	}
	return p, nil
}

// Meta implements Piece.
func (p *JSPiece) Meta() Meta { return p.meta }

// SetLook switches to another look, keeping the same runtime.
func (p *JSPiece) SetLook(look Look) error {
	if p.handle != nil {
		_, _ = p.drop(goja.Undefined(), p.handle)
	}
	first := p.vm.ToValue(p.meta.Slug)
	if p.spec != "" {
		first = p.vm.ToValue(p.spec)
	}
	h, err := p.create(goja.Undefined(), first, p.vm.ToValue(look.json()))
	if err != nil {
		return &JSError{p.meta.Slug, err.Error()}
	}
	p.handle, p.palette = h, p.meta.Palette
	if p.state != "" {
		return p.SetState(p.state)
	}
	return nil
}

// TryDraw is the frame at t seconds, or the error the piece threw.
func (p *JSPiece) TryDraw(t float64) (Frame, error) {
	v, err := p.draw(goja.Undefined(), p.handle, p.vm.ToValue(t))
	if err != nil {
		return Frame{}, &JSError{p.meta.Slug, err.Error()}
	}
	parts := strings.SplitN(v.String(), "\x00", 3)
	for len(parts) < 3 {
		parts = append(parts, "")
	}
	if parts[2] != "" {
		var m map[string]string
		if json.Unmarshal([]byte(parts[2]), &m) == nil {
			p.palette = paletteFromMap(m)
		}
	}
	f := FrameFromLayers(parts[0], parts[1], &p.palette, p.meta.Cols, p.meta.Rows)
	f.Square = p.meta.Square
	return f, nil
}

// Draw implements Piece. If the piece throws, it returns a blank frame; use TryDraw
// to see the error (the Model does, and shows the last good frame).
func (p *JSPiece) Draw(t float64) Frame {
	f, err := p.TryDraw(t)
	if err != nil {
		f = BlankFrame(p.meta.Cols, p.meta.Rows)
		f.Square = p.meta.Square
	}
	return f
}
