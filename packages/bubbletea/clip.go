package asciiart

import (
	"bytes"
	"compress/flate"
	"encoding/binary"
	"encoding/json"
	"errors"
	"io"
	"math"
	"os"
	"strings"
)

// Clip is an .amc clip: frames recorded from a video, a GIF or any piece by
// `ama-studio convert clip.mp4 -o clip.amc`. It is a Piece that picks a frame by
// time, so it needs no JS engine.
type Clip struct {
	meta   Meta
	frames []Frame
	loop   bool
}

// OpenClip reads a clip file.
func OpenClip(path string) (*Clip, error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()
	return LoadClip(f)
}

// LoadClip decodes a clip ("AMC1", u32 LE header length, JSON header, raw deflate frames).
func LoadClip(r io.Reader) (*Clip, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return nil, err
	}
	if len(data) < 8 || string(data[:4]) != "AMC1" {
		return nil, errors.New("asciiart: not an .amc clip")
	}
	n := int(binary.LittleEndian.Uint32(data[4:8]))
	if len(data) < 8+n {
		return nil, errors.New("asciiart: clip header cut short")
	}
	h := struct {
		Cols, Rows, Frames int
		FPS                float64
		Square             bool
		Loop               *bool
		Palette            map[string]string
		Name               string
	}{}
	if err := json.Unmarshal(data[8:8+n], &h); err != nil {
		return nil, err
	}
	body, err := io.ReadAll(flate.NewReader(bytes.NewReader(data[8+n:])))
	if err != nil {
		return nil, err
	}
	pal := paletteFromMap(h.Palette)
	parts := strings.Split(string(body), "\x00")
	c := &Clip{loop: h.Loop == nil || *h.Loop}
	for i := 0; i+1 < len(parts) && len(c.frames) < h.Frames; i += 2 {
		f := FrameFromLayers(parts[i], parts[i+1], &pal, h.Cols, h.Rows)
		f.Square = h.Square
		c.frames = append(c.frames, f)
	}
	if len(c.frames) == 0 {
		return nil, errors.New("asciiart: the clip has no frames")
	}
	if h.Name == "" {
		h.Name = "clip"
	}
	c.meta = NewMeta(h.Name, h.Cols, h.Rows)
	c.meta.Category, c.meta.FPS, c.meta.Square, c.meta.Palette = "extras", h.FPS, h.Square, pal
	return c, nil
}

// Meta implements Piece.
func (c *Clip) Meta() Meta { return c.meta }

// Frames are the clip's frames, in order.
func (c *Clip) Frames() []Frame { return c.frames }

// Duration is one pass, in seconds.
func (c *Clip) Duration() float64 { return float64(len(c.frames)) / c.meta.FPS }

// Draw implements Piece.
func (c *Clip) Draw(t float64) Frame {
	n := len(c.frames)
	i := int(math.Floor(t * c.meta.FPS))
	if c.loop {
		i = ((i % n) + n) % n
	} else {
		i = min(max(i, 0), n-1)
	}
	return c.frames[i]
}
