package asciiart

import (
	"bytes"
	"compress/flate"
	"encoding/json"
	"errors"
	"io"
	"os"
	"regexp"
	"slices"
	"sort"
	"strings"
	"testing"
	"time"

	"github.com/ubum3/ascii-magic-art/packages/bubbletea/slug"
)

// Chaotic orbits and flocks: one last-bit difference in sin() over many steps gives a
// different, equally valid picture. Size check only, like the clock pieces.
var chaotic = []string{"clifford-attractor", "rest-starlings"}

// Every library piece, drawn in goja, against the frame Node drew
// (packages/fixtures/golden.bin, from `npm run native` in the repo root).
// A piece passes at 99% of cells matching. `go test -v -run Parity` prints the slowest;
// -short skips it.
func TestParityWithNode(t *testing.T) {
	if testing.Short() {
		t.Skip("about 2 minutes: every piece in goja")
	}
	raw, err := os.ReadFile("../fixtures/golden.bin")
	if err != nil {
		t.Skip("no packages/fixtures/golden.bin (outside the repo?)")
	}
	data, err := io.ReadAll(flate.NewReader(bytes.NewReader(raw)))
	if err != nil {
		t.Fatal(err)
	}
	var golden map[string][2]string
	if err := json.Unmarshal(data, &golden); err != nil {
		t.Fatal(err)
	}
	// ascii.rest's pieces (rest-*), when the bundle has them.
	if raw, err := os.ReadFile("../fixtures/rest-golden.bin"); err == nil {
		data, err := io.ReadAll(flate.NewReader(bytes.NewReader(raw)))
		if err != nil {
			t.Fatal(err)
		}
		if err := json.Unmarshal(data, &golden); err != nil {
			t.Fatal(err)
		}
	}
	type timing struct {
		slug       string
		draw, load time.Duration
	}
	var times []timing
	for _, meta := range Catalog() {
		start := time.Now()
		p, err := NewJSPiece(meta.Slug, Look{})
		if err != nil {
			t.Fatal(err)
		}
		load := time.Since(start)
		var f Frame
		start = time.Now()
		for _, tt := range []float64{0, 0.5, 1.5} {
			if f, err = p.TryDraw(tt); err != nil {
				t.Fatal(err)
			}
		}
		times = append(times, timing{meta.Slug, time.Since(start) / 3, load})
		if f.Cols != meta.Cols || f.Rows != meta.Rows || len(f.Cells) != meta.Cols*meta.Rows {
			t.Errorf("%s: frame is %dx%d", meta.Slug, f.Cols, f.Rows)
		}
		if meta.Clock || slices.Contains(chaotic, meta.Slug) {
			continue
		}
		g := golden[meta.Slug]
		want := FrameFromLayers(g[0], g[1], &meta.Palette, meta.Cols, meta.Rows)
		same := 0
		for i := range want.Cells {
			if want.Cells[i] == f.Cells[i] {
				same++
			}
		}
		if share := float64(same) / float64(len(want.Cells)); share < 0.99 {
			t.Errorf("%s: %.1f%% of cells match Node", meta.Slug, share*100)
			if os.Getenv("AMA_DIFF") == meta.Slug {
				got, exp := strings.Split(f.Text(), "\n"), strings.Split(want.Text(), "\n")
				for i := range got {
					if got[i] != exp[i] {
						t.Logf("goja %s\nnode %s", got[i], exp[i])
					}
				}
			}
		}
	}
	sort.Slice(times, func(i, j int) bool { return times[i].draw > times[j].draw })
	var total time.Duration
	for _, x := range times {
		total += x.draw
	}
	t.Logf("mean %.2f ms per frame over %d pieces; slowest (per frame, load):", float64(total.Microseconds())/1e3/float64(len(times)), len(times))
	for _, x := range times[:12] {
		t.Logf("  %-32s %7.1f ms %7.1f ms", x.slug, float64(x.draw.Microseconds())/1e3, float64(x.load.Microseconds())/1e3)
	}
}

func TestCatalogAndErrors(t *testing.T) {
	if len(Catalog()) != len(slug.All) || len(slug.All) < 600 {
		t.Fatalf("catalog %d, slugs %d", len(Catalog()), len(slug.All))
	}
	m, ok := MetaOf(slug.SpinningTorus)
	if !ok || m.Cols != 48 || m.Rows != 24 {
		t.Fatalf("spinning-torus meta %+v", m)
	}
	_, err := FromSlug("spining-torus")
	var u *UnknownPieceError
	if !errors.As(err, &u) || !slices.Contains(u.Suggestions, "spinning-torus") {
		t.Fatalf("want suggestions, got %v", err)
	}
}

func TestLooks(t *testing.T) {
	p, err := NewJSPiece(slug.SpinningTorus, LookOf(Dots))
	if err != nil {
		t.Fatal(err)
	}
	f, _ := p.TryDraw(1)
	if !strings.Contains(f.Text(), "●") {
		t.Fatal("dots look has no dots")
	}
	if err := p.SetLook(Look{}); err != nil {
		t.Fatal(err)
	}
	if f, _ = p.TryDraw(1); strings.Contains(f.Text(), "●") {
		t.Fatal("back to the original look")
	}
	c := 50.0
	if got := (Look{Look: Dots, Contrast: &c}).json(); got != `{"gamma":0.75,"look":"dots"}` {
		t.Fatal(got)
	}
}

var escapes = regexp.MustCompile("\x1b\\[[0-9;]*m")

func plain(s string) []string { return strings.Split(escapes.ReplaceAllString(s, ""), "\n") }

// A 4x2 frame: "abcd" / "efgh", the first cell red.
func testFrame() Frame {
	p := NewPalette("#ff0000")
	return FrameFromLayers("abcd\nefgh", "0   \n    ", &p, 4, 2)
}

func TestRenderFits(t *testing.T) {
	f := testFrame()
	cases := []struct {
		s    Style
		want []string
	}{
		{Style{Width: 8, Height: 4}, []string{"        ", "  abcd  ", "  efgh  ", "        "}},
		{Style{Width: 2, Height: 1}, []string{"bc"}},
		{Style{Width: 6, Height: 3, Align: AlignTopLeft}, []string{"abcd  ", "efgh  ", "      "}},
		{Style{Width: 8, Height: 4, Fit: FitCover}, []string{"aabbccdd", "aabbccdd", "eeffgghh", "eeffgghh"}},
		{Style{Width: 12, Height: 2, Fit: FitContain}, []string{"    abcd    ", "    efgh    "}},
		{Style{Width: 8, Height: 2, Fit: FitStretch}, []string{"aabbccdd", "eeffgghh"}},
		{Style{Width: 6, Height: 3, Fit: FitTile}, []string{"abcdab", "efghef", "abcdab"}},
		{Style{}, []string{"abcd", "efgh"}},
	}
	for _, c := range cases {
		if got := plain(Render(&f, c.s)); !slices.Equal(got, c.want) {
			t.Errorf("%+v: got %q want %q", c.s, got, c.want)
		}
	}
}

func TestRenderColours(t *testing.T) {
	f := testFrame()
	out := Render(&f, Style{})
	if !strings.HasPrefix(out, "\x1b[38;2;255;0;0ma\x1b[39mbcd") {
		t.Fatalf("%q", out)
	}
	if out := Render(&f, Style{Dim: 0.5}); !strings.HasPrefix(out, "\x1b[38;2;128;0;0ma\x1b[38;2;102;102;102mbcd") {
		t.Fatalf("dim: %q", out)
	}
	bg := RGB{1, 2, 3}
	if out := Render(&f, Style{Width: 5, Height: 2, BG: &bg, Align: AlignTopLeft}); !strings.Contains(out, "\x1b[48;2;1;2;3m") {
		t.Fatalf("bg: %q", out)
	}
	p := NewPalette("#ff0000", "#0000ff")
	sq := FrameFromLayers("██\n▄▄", "00\n11", &p, 2, 2)
	sq.Square = true
	if out := Render(&sq, Style{}); out != "\x1b[38;2;255;0;0m\x1b[48;2;0;0;163m▀▀\x1b[m" {
		t.Fatalf("half blocks: %q", out)
	}
}

func TestModelPlaysAndPauses(t *testing.T) {
	m := MustSlug(slug.SpinningTorus, WithSize(60, 24), WithFit(FitCenter))
	msg := m.Init()()
	m, next := m.Update(msg)
	if !m.Ready() || next == nil {
		t.Fatal("first frame in, next one scheduled")
	}
	if lines := plain(m.View()); len(lines) != 24 || len([]rune(lines[0])) != 60 {
		t.Fatalf("view is %d lines", len(lines))
	}
	t0 := m.Time()
	m, _ = m.Update(next())
	if m.Time() <= t0 {
		t.Fatal("clock moves")
	}
	// Pausing drops the frame already on its way, and schedules nothing.
	pending := m.drawCmd(0, m.t, time.Now())
	m.Pause()
	m, next = m.Update(pending())
	if next != nil {
		t.Fatal("paused: no more frames")
	}
	cmd := m.Resume()
	m, next = m.Update(cmd())
	if next == nil || m.Paused() {
		t.Fatal("resumed")
	}
	// Another model's frames are ignored.
	other := MustSlug(slug.MatrixRain)
	before := m.Time()
	m, _ = m.Update(other.Init()())
	if m.Time() != before {
		t.Fatal("took another model's frame")
	}
}

type badge struct {
	meta Meta
	g    *Grid
}

func (b badge) Meta() Meta { return b.meta }
func (b badge) Draw(t float64) Frame {
	b.g.Clear()
	b.g.Box(0, 0, 12, 3, BoxRound, '1')
	b.g.Text(2, 1, "build #"+string(rune('0'+int(t))), '0')
	return b.g.Frame(&b.meta.Palette)
}

func TestCustomPiece(t *testing.T) {
	meta := NewMeta("badge", 12, 3)
	meta.Palette = NewPalette("#7ee787", "#8b949e")
	m := New(badge{meta, NewGrid(12, 3)}, WithStart(7))
	m, _ = m.Update(m.Init()())
	f := m.Frame()
	if f.Text() != "╭──────────╮\n│ build #7 │\n╰──────────╯" {
		t.Fatalf("%q", f.Text())
	}
	if c := f.At(2, 1); !c.HasFG || c.FG != MustHex("#7ee787") {
		t.Fatalf("%+v", c)
	}
	g := NewGrid(5, 5)
	g.Line(0, 0, 4, 4, '*', NoKey)
	if g.Get(2, 2) != '*' || g.Get(4, 4) != '*' {
		t.Fatal("diagonal line")
	}
}

func TestBackgroundOverlay(t *testing.T) {
	art := strings.TrimSuffix(strings.Repeat("░░░░░░░░\n", 4), "\n")
	got := plain(Background(art, "hi", 8, 4))
	if got[1] != "░░░hi░░░" && got[2] != "░░░hi░░░" {
		t.Fatalf("%q", got)
	}
}
