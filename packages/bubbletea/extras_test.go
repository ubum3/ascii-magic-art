package asciiart

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"encoding/json"
	"image"
	"image/color"
	"io"
	"os"
	"strings"
	"testing"
)

// Every packages/extras fixture, drawn in goja, against the frame Node drew
// (packages/fixtures/extras-golden.bin, from `npm run native`).
func TestExtrasParityWithNode(t *testing.T) {
	raw, err := os.ReadFile("../fixtures/extras-golden.bin")
	if err != nil {
		t.Skip("no packages/fixtures/extras-golden.bin (outside the repo?)")
	}
	data, err := io.ReadAll(flate.NewReader(bytes.NewReader(raw)))
	if err != nil {
		t.Fatal(err)
	}
	var golden map[string]struct {
		Spec  json.RawMessage `json:"spec"`
		State json.RawMessage `json:"state"`
		Times []float64       `json:"times"`
		Frame [2]string       `json:"frame"`
	}
	if err := json.Unmarshal(data, &golden); err != nil {
		t.Fatal(err)
	}
	if len(golden) < 20 {
		t.Fatalf("%d fixtures", len(golden))
	}
	for name, g := range golden {
		p, err := NewSpecPiece(string(g.Spec), Look{})
		if err != nil {
			t.Fatalf("%s: %v", name, err)
		}
		if s := string(g.State); s != "null" && s != "" {
			if err := p.SetState(s); err != nil {
				t.Fatal(err)
			}
		}
		var f Frame
		for _, tt := range g.Times {
			if f, err = p.TryDraw(tt); err != nil {
				t.Fatalf("%s: %v", name, err)
			}
		}
		m := p.Meta()
		want := FrameFromLayers(g.Frame[0], g.Frame[1], &m.Palette, m.Cols, m.Rows)
		same := 0
		for i := range want.Cells {
			if want.Cells[i] == f.Cells[i] {
				same++
			}
		}
		if share := float64(same) / float64(len(want.Cells)); share < 0.99 {
			t.Errorf("%s: %.1f%% of cells match Node", name, share*100)
		}
	}
}

func TestSpecModelsAndState(t *testing.T) {
	m, err := ProgressSpec(20).With("label", "Up").Model()
	if err != nil {
		t.Fatal(err)
	}
	if mm := m.Meta(); mm.Cols != 20 || mm.Rows != 2 {
		t.Fatalf("%+v", mm)
	}
	text := func(m Model) string { f := m.Frame(); return f.Text() }
	m.SetState(map[string]any{"value": 1})
	m, next := m.Update(m.Init()())
	for i := 0; i < 60 && !strings.Contains(text(m), "✓ done"); i++ {
		m, next = m.Update(next())
	}
	if !strings.Contains(text(m), "✓ done") {
		t.Fatalf("state drawn:\n%s", text(m))
	}
	if _, err := FromSpec(`{"kind":"nope"}`); err == nil || !strings.Contains(err.Error(), "unknown kind") {
		t.Fatalf("bad kind: %v", err)
	}
	if _, err := ParseSpec([]byte(`{"text":"x"}`)); err == nil {
		t.Fatal("a spec needs a kind")
	}
	c, err := NewSpecPiece(CelebrateSpec("ok", Check).JSON(), Look{})
	if err != nil {
		t.Fatal(err)
	}
	if f, _ := c.TryDraw(2); !strings.Contains(f.Text(), "ok") {
		t.Fatal(f.Text())
	}
	d, err := NewSpecPiece(TextSpec("HI").Effect(PlainText).JSON(), LookOf(Dots))
	if err != nil {
		t.Fatal(err)
	}
	if f, _ := d.TryDraw(2); !strings.ContainsAny(f.Text(), "·•●") {
		t.Fatal("specs take looks:\n" + f.Text())
	}
}

func TestImageSpec(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 64, 32))
	for y := 0; y < 32; y++ {
		for x := 0; x < 64; x++ {
			img.Set(x, y, color.RGBA{uint8(x * 4), uint8(y * 8), 200, 255})
		}
	}
	s, err := ImageSpec(img, 32, true)
	if err != nil {
		t.Fatal(err)
	}
	if s["cols"].(float64) != 32 || s["rows"].(float64) != 16 {
		t.Fatalf("%v x %v", s["cols"], s["rows"])
	}
	p, err := NewSpecPiece(s.JSON(), Look{})
	if err != nil {
		t.Fatal(err)
	}
	f, _ := p.TryDraw(0)
	if !p.Meta().Square || f.Cols != 32 || !f.At(5, 5).HasFG {
		t.Fatalf("%+v", p.Meta())
	}
	if _, err := ImageSpecFromRGBA(make([]byte, 5), 3, 3, "{}"); err == nil {
		t.Fatal("wrong size")
	}
}

func clipBytes() []byte {
	head := []byte(`{"version":1,"cols":2,"rows":1,"fps":2,"frames":2,"square":false,"loop":true,"palette":{"0":"#ff0000"}}`)
	var z bytes.Buffer
	w, _ := flate.NewWriter(&z, flate.DefaultCompression)
	w.Write([]byte("ab\x000 \x00xy\x00\x00"))
	w.Close()
	out := append([]byte("AMC1"), binary.LittleEndian.AppendUint32(nil, uint32(len(head)))...)
	return append(append(out, head...), z.Bytes()...)
}

func TestClips(t *testing.T) {
	c, err := LoadClip(bytes.NewReader(clipBytes()))
	if err != nil {
		t.Fatal(err)
	}
	if len(c.Frames()) != 2 || c.Duration() != 1 {
		t.Fatal("two frames, one second")
	}
	if f := c.Draw(0); f.Text() != "ab" || !f.At(0, 0).HasFG || f.At(0, 0).FG != MustHex("#ff0000") {
		t.Fatalf("%q", f.Text())
	}
	if f1, f2 := c.Draw(0.5), c.Draw(1); f1.Text() != "xy" || f2.Text() != "ab" {
		t.Fatal("plays and loops")
	}
	if _, err := LoadClip(strings.NewReader("nope")); err == nil {
		t.Fatal("not a clip")
	}
}

func TestTransitions(t *testing.T) {
	a := strings.TrimSuffix(strings.Repeat("\x1b[31maaaaaaaaaa\x1b[m\n", 4), "\n")
	z := strings.TrimSuffix(strings.Repeat("zzzzzzzzzz\n", 4), "\n")
	count := func(s, ch string) int { return strings.Count(strings.Join(plain(s), ""), ch) }
	for _, k := range Transitions {
		if count(Transition(k, a, z, 10, 4, 0), "a") != 40 || count(Transition(k, a, z, 10, 4, 1), "z") != 40 {
			t.Fatalf("%s: ends", k)
		}
		mid := Transition(k, a, z, 10, 4, 0.5)
		if count(mid, "a") == 40 {
			t.Fatalf("%s: half way has started", k)
		}
		if lines := plain(mid); len(lines) != 4 || len([]rune(lines[0])) != 10 {
			t.Fatalf("%s: %q", k, lines)
		}
	}
	w := plain(Transition(WipeRight, a, z, 10, 4, 0.5))
	if w[0][0] != 'z' || w[0][9] != 'a' {
		t.Fatalf("wipe right: %q", w[0])
	}
	if !strings.Contains(Transition(Dissolve, a, z, 10, 4, 0.5), "\x1b[31m") {
		t.Fatal("keeps colours")
	}
}

func TestCasts(t *testing.T) {
	p, err := NewSpecPiece(TextSpec("OK").Effect(Typewriter).JSON(), Look{})
	if err != nil {
		t.Fatal(err)
	}
	var b bytes.Buffer
	if err := WriteCast(&b, p, 1, 10); err != nil {
		t.Fatal(err)
	}
	lines := strings.Split(strings.TrimSpace(b.String()), "\n")
	var head map[string]any
	json.Unmarshal([]byte(lines[0]), &head)
	if head["version"].(float64) != 2 || int(head["width"].(float64)) != p.Meta().Cols || len(lines) < 4 {
		t.Fatalf("%v, %d lines", head, len(lines))
	}
	var ev []any
	json.Unmarshal([]byte(lines[2]), &ev)
	if s := ev[2].(string); !strings.HasPrefix(s, "\x1b[H") || !strings.Contains(s, "\x1b[38;2;") {
		t.Fatalf("%q", s)
	}
}
