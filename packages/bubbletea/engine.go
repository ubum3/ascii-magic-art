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
	meta    Meta
	palette Palette
	vm      *goja.Runtime
	create  goja.Callable
	draw    goja.Callable
	drop    goja.Callable
	handle  goja.Value
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
	h, err := p.create(goja.Undefined(), p.vm.ToValue(p.meta.Slug), p.vm.ToValue(look.json()))
	if err != nil {
		return &JSError{p.meta.Slug, err.Error()}
	}
	p.handle, p.palette = h, p.meta.Palette
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
