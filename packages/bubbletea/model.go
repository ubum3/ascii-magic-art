package asciiart

import (
	"encoding/json"
	"sync"
	"sync/atomic"
	"time"

	tea "charm.land/bubbletea/v2"
)

var nextID atomic.Int64

// player is the part of a Model shared between its copies and its commands:
// the piece, behind a lock, since a draw runs in a command's goroutine.
type player struct {
	mu    sync.Mutex
	piece Piece
	// State waiting for the next draw, so setting it never waits on a draw.
	stateMu sync.Mutex
	state   *string
}

// frameMsg carries a finished frame back to the Model that asked for it.
type frameMsg struct {
	id, gen int64
	frame   Frame
	err     error
	t       float64
	at      time.Time
}

// Model plays a piece. It's a Bubble Tea component in the style of the bubbles:
// call Init, pass every message to Update, and put View() in your own view.
//
// Drawing happens in a command, off the UI loop, so a heavy piece drops frames
// instead of slowing your app. Copies of a Model share the same piece.
type Model struct {
	id, gen int64
	p       *player
	meta    Meta
	style   Style
	speed   float64
	maxFPS  float64
	still   bool
	paused  bool
	t       float64
	frame   Frame
	err     error
	look    *Look
	ready   bool
}

// Option sets up a Model.
type Option func(*Model)

// WithSize sets the width and height the art fills. Zero uses the piece's own size.
func WithSize(w, h int) Option { return func(m *Model) { m.style.Width, m.style.Height = w, h } }

// WithFit sets how the art fills its size. Default FitCenter.
func WithFit(f Fit) Option { return func(m *Model) { m.style.Fit = f } }

// WithAlign sets where the art sits. Default AlignCenter.
func WithAlign(a Align) Option { return func(m *Model) { m.style.Align = a } }

// WithDim blends the art toward the background: 0 is full strength, 1 is gone.
func WithDim(d float64) Option { return func(m *Model) { m.style.Dim = clamp01(d) } }

// WithBackground paints a colour behind the whole area.
func WithBackground(c RGB) Option { return func(m *Model) { m.style.BG = &c } }

// WithMono draws every cell in one colour.
func WithMono(c RGB) Option { return func(m *Model) { m.style.Mono = &c } }

// WithLook redraws a library piece in a look.
func WithLook(l Look) Option { return func(m *Model) { m.look = &l } }

// WithSpeed sets the playback speed. Default 1.
func WithSpeed(s float64) Option { return func(m *Model) { m.speed = s } }

// WithStill shows one frame and stops the clock.
func WithStill() Option { return func(m *Model) { m.still = true } }

// WithMaxFPS caps the frame rate below the piece's own.
func WithMaxFPS(fps float64) Option { return func(m *Model) { m.maxFPS = fps } }

// WithStart starts t seconds into the piece.
func WithStart(t float64) Option { return func(m *Model) { m.t = t } }

// New plays your own piece.
func New(piece Piece, opts ...Option) Model {
	meta := piece.Meta()
	m := Model{id: nextID.Add(1), p: &player{piece: piece}, meta: meta, speed: 1, frame: BlankFrame(meta.Cols, meta.Rows)}
	m.frame.Square = meta.Square
	for _, o := range opts {
		o(&m)
	}
	return m
}

// FromSlug plays a library piece. An unknown slug is an *UnknownPieceError with suggestions.
func FromSlug(slug string, opts ...Option) (Model, error) {
	var look Look
	probe := Model{}
	for _, o := range opts {
		o(&probe)
	}
	if probe.look != nil {
		look = *probe.look
	}
	p, err := NewJSPiece(slug, look)
	if err != nil {
		return Model{}, err
	}
	m := New(p, opts...)
	m.look = nil // already applied
	return m, nil
}

// MustSlug is FromSlug that panics, for slugs you know are right (see package slug).
func MustSlug(slug string, opts ...Option) Model {
	m, err := FromSlug(slug, opts...)
	if err != nil {
		panic(err)
	}
	return m
}

// Init draws the first frame and starts playback.
func (m Model) Init() tea.Cmd { return m.drawCmd(0, m.t, time.Now()) }

// drawCmd draws after a delay, at the time the clock reads by then.
func (m Model) drawCmd(delay time.Duration, t float64, at time.Time) tea.Cmd {
	id, gen, p, look, speed, running := m.id, m.gen, m.p, m.look, m.speed, !m.paused && !m.still
	draw := func(now time.Time) tea.Msg {
		p.mu.Lock()
		defer p.mu.Unlock()
		tt := t
		if running {
			tt += now.Sub(at).Seconds() * speed
		}
		msg := frameMsg{id: id, gen: gen, t: tt, at: now}
		if look != nil {
			if l, ok := p.piece.(Looker); ok {
				msg.err = l.SetLook(*look)
			}
		}
		p.stateMu.Lock()
		state := p.state
		p.state = nil
		p.stateMu.Unlock()
		if state != nil {
			if s, ok := p.piece.(Stater); ok {
				if err := s.SetState(*state); err != nil {
					msg.err = err
				}
			}
		}
		if js, ok := p.piece.(*JSPiece); ok {
			f, err := js.TryDraw(tt)
			msg.frame, msg.err = f, err
		} else {
			msg.frame = p.piece.Draw(tt)
		}
		return msg
	}
	if delay <= 0 {
		return func() tea.Msg { return draw(time.Now()) }
	}
	return tea.Tick(delay, draw)
}

func (m Model) period() time.Duration {
	fps := m.meta.FPS
	if m.maxFPS > 0 && m.maxFPS < fps {
		fps = m.maxFPS
	}
	return time.Duration(float64(time.Second) / max(fps, 0.5))
}

// Update takes the frames this Model asked for and schedules the next one.
func (m Model) Update(msg tea.Msg) (Model, tea.Cmd) {
	f, ok := msg.(frameMsg)
	if !ok || f.id != m.id || f.gen != m.gen {
		return m, nil
	}
	m.look = nil
	m.err = f.err
	if f.err == nil {
		m.frame, m.ready = f.frame, true
	}
	m.t = f.t
	if m.paused || m.still {
		return m, nil
	}
	left := m.period() - time.Since(f.at)
	return m, m.drawCmd(max(left, time.Millisecond), m.t, time.Now())
}

// restart starts a fresh chain of draws, so frames already on their way are dropped.
func (m *Model) restart() tea.Cmd {
	m.gen++
	return m.drawCmd(0, m.t, time.Now())
}

// View is the art at its size.
func (m Model) View() string { return Render(&m.frame, m.style) }

// Frame is the newest frame.
func (m Model) Frame() Frame { return m.frame }

// Meta is the piece's meta.
func (m Model) Meta() Meta { return m.meta }

// Time is the piece's clock in seconds.
func (m Model) Time() float64 { return m.t }

// Err is why the last draw failed, if it did.
func (m Model) Err() error { return m.err }

// Ready is true once the first frame is in.
func (m Model) Ready() bool { return m.ready }

// Paused reports whether playback is paused.
func (m Model) Paused() bool { return m.paused }

// SetSize sets the width and height the art fills.
func (m *Model) SetSize(w, h int) { m.style.Width, m.style.Height = w, h }

// Size is the width and height View fills.
func (m Model) Size() (int, int) {
	w, h := m.style.Width, m.style.Height
	if w <= 0 {
		w = m.frame.Cols
	}
	if h <= 0 {
		h = m.frame.TermRows()
	}
	return w, h
}

// SetFit sets how the art fills its size.
func (m *Model) SetFit(f Fit) { m.style.Fit = f }

// SetDim sets how far the art is blended toward the background (0 to 1).
func (m *Model) SetDim(d float64) { m.style.Dim = clamp01(d) }

// Style is how View draws the frame. Change it with the setters or SetStyle.
func (m Model) Style() Style { return m.style }

// SetStyle replaces how View draws the frame.
func (m *Model) SetStyle(s Style) { m.style = s }

// Pause freezes on the current frame.
func (m *Model) Pause() {
	m.paused = true
	m.gen++
}

// Resume carries on from the frame it paused on.
func (m *Model) Resume() tea.Cmd {
	if !m.paused {
		return nil
	}
	m.paused = false
	return m.restart()
}

// TogglePause pauses or resumes.
func (m *Model) TogglePause() tea.Cmd {
	if m.paused {
		return m.Resume()
	}
	m.Pause()
	return nil
}

// Seek jumps to t seconds.
func (m *Model) Seek(t float64) tea.Cmd {
	m.t = t
	return m.restart()
}

// SetSpeed changes the playback speed.
func (m *Model) SetSpeed(s float64) tea.Cmd {
	m.speed = s
	return m.restart()
}

// SetLook redraws a library piece in another look.
func (m *Model) SetLook(l Look) tea.Cmd {
	m.look = &l
	return m.restart()
}

// Stater is a piece that draws state as well as time. Spec pieces are.
type Stater interface {
	SetState(json string) error
}

// FromSpec plays an extras spec (JSON): a logo from `ama-studio brand`, animated
// text, a progress bar, a picture... See Spec for building one in Go.
func FromSpec(spec string, opts ...Option) (Model, error) {
	var look Look
	probe := Model{}
	for _, o := range opts {
		o(&probe)
	}
	if probe.look != nil {
		look = *probe.look
	}
	p, err := NewSpecPiece(spec, look)
	if err != nil {
		return Model{}, err
	}
	m := New(p, opts...)
	m.look = nil // already applied
	return m, nil
}

// SetState gives a data spec its state: anything that marshals to the kind's state,
// such as map[string]any{"value": 0.4}, or a JSON string. The next frame draws it.
// Return the command from your Update: a paused or still model needs it to redraw.
func (m *Model) SetState(v any) tea.Cmd {
	var s string
	switch x := v.(type) {
	case string:
		s = x
	case []byte:
		s = string(x)
	default:
		b, err := json.Marshal(v)
		if err != nil {
			m.err = err
			return nil
		}
		s = string(b)
	}
	m.p.stateMu.Lock()
	m.p.state = &s
	m.p.stateMu.Unlock()
	if m.paused || m.still {
		return m.restart()
	}
	return nil
}
