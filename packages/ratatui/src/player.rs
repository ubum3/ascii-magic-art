//! `Player`: plays a piece on its own thread and always has a finished frame ready.

use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Condvar, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};

use crate::Error;
use crate::engine::{self, JsPiece};
use crate::frame::Frame;
use crate::look::Look;
use crate::piece::{Meta, Piece};

struct Ctl {
    stop: bool,
    paused: bool,
    still: bool,
    speed: f64,
    max_fps: Option<f64>,
    seek: Option<f64>,
    look: Option<Look>,
    /// Something changed that needs a redraw even while paused.
    dirty: bool,
}

struct Shared {
    ctl: Mutex<Ctl>,
    wake: Condvar,
    frame: Mutex<Arc<Frame>>,
    /// Bumps on every new frame, so a render loop can tell when to redraw.
    frame_id: AtomicU64,
    /// The piece's time in seconds, as f64 bits.
    time: AtomicU64,
    error: Mutex<Option<String>>,
}

type Make = Box<dyn FnOnce() -> Result<Box<dyn Piece>, Error> + Send>;

/// Plays a piece in the background. [`frame`](Player::frame) never blocks: it hands
/// back the newest finished frame, so a heavy piece drops frames instead of stalling
/// your UI. Dropping the player stops its thread.
///
/// ```no_run
/// use ascii_magic_art_ratatui::{LookName, Player};
/// let player = Player::from_slug("moonlit-sea")?.speed(0.5).look(LookName::Dots);
/// # Ok::<(), ascii_magic_art_ratatui::Error>(())
/// ```
pub struct Player {
    meta: Meta,
    shared: Arc<Shared>,
    thread: Option<JoinHandle<()>>,
}

impl Player {
    /// Play a library piece. Fails at once on an unknown slug, with suggestions.
    pub fn from_slug(slug: &str) -> Result<Player, Error> {
        let meta = engine::meta(slug)
            .ok_or_else(|| engine::unknown(slug))?
            .clone();
        let s = slug.to_string();
        Ok(Player::spawn(
            meta,
            Box::new(move || Ok(Box::new(JsPiece::new(&s)?) as Box<dyn Piece>)),
        ))
    }

    /// Play your own piece.
    pub fn new<P: Piece + Send + 'static>(piece: P) -> Player {
        let meta = piece.meta().clone();
        Player::spawn(
            meta,
            Box::new(move || Ok(Box::new(piece) as Box<dyn Piece>)),
        )
    }

    fn spawn(meta: Meta, make: Make) -> Player {
        let blank = Frame {
            square: meta.square,
            ..Frame::blank(meta.cols, meta.rows)
        };
        let shared = Arc::new(Shared {
            ctl: Mutex::new(Ctl {
                stop: false,
                paused: false,
                still: false,
                speed: 1.0,
                max_fps: None,
                seek: None,
                look: None,
                dirty: false,
            }),
            wake: Condvar::new(),
            frame: Mutex::new(Arc::new(blank)),
            frame_id: AtomicU64::new(0),
            time: AtomicU64::new(0f64.to_bits()),
            error: Mutex::new(None),
        });
        let (sh, fps) = (shared.clone(), meta.fps);
        let thread = std::thread::Builder::new()
            .name(format!("ascii-art {}", meta.slug))
            .spawn(move || run(sh, make, fps))
            .expect("spawn player thread");
        Player {
            meta,
            shared,
            thread: Some(thread),
        }
    }

    /// Change a control and redraw.
    fn ctl(&self, f: impl FnOnce(&mut Ctl)) {
        self.ctl_quiet(|c| {
            f(c);
            c.dirty = true;
        });
    }

    /// Change a control without forcing a redraw (pause and resume keep the frame).
    fn ctl_quiet(&self, f: impl FnOnce(&mut Ctl)) {
        let mut c = self.shared.ctl.lock().unwrap();
        f(&mut c);
        self.shared.wake.notify_all();
    }

    /// The newest frame. Blank (but the right size) until the first one is drawn.
    pub fn frame(&self) -> Arc<Frame> {
        self.shared.frame.lock().unwrap().clone()
    }

    /// Goes up by one with every new frame.
    pub fn frame_id(&self) -> u64 {
        self.shared.frame_id.load(Ordering::Acquire)
    }

    /// Wait until the first frame is ready, up to `timeout`. True if it is.
    pub fn wait_ready(&self, timeout: Duration) -> bool {
        let end = Instant::now() + timeout;
        while self.frame_id() == 0 && self.error().is_none() {
            if Instant::now() >= end {
                return false;
            }
            std::thread::sleep(Duration::from_millis(2));
        }
        self.frame_id() > 0
    }

    pub fn meta(&self) -> &Meta {
        &self.meta
    }

    /// The piece's clock in seconds.
    pub fn time(&self) -> f64 {
        f64::from_bits(self.shared.time.load(Ordering::Acquire))
    }

    /// Why the piece failed to load or draw, if it did.
    pub fn error(&self) -> Option<String> {
        self.shared.error.lock().unwrap().clone()
    }

    pub fn is_paused(&self) -> bool {
        self.shared.ctl.lock().unwrap().paused
    }

    /// Freeze on the current frame.
    pub fn pause(&self) {
        self.ctl_quiet(|c| c.paused = true);
    }

    /// Carry on from the frame it was paused on.
    pub fn resume(&self) {
        self.ctl_quiet(|c| c.paused = false);
    }

    pub fn toggle_pause(&self) {
        self.ctl_quiet(|c| c.paused = !c.paused);
    }

    /// Jump to `t` seconds.
    pub fn seek(&self, t: f64) {
        self.ctl(|c| c.seek = Some(t));
    }

    pub fn set_speed(&self, speed: f64) {
        self.ctl(|c| c.speed = speed);
    }

    /// Show one frame and stop the clock.
    pub fn set_still(&self, still: bool) {
        self.ctl(|c| c.still = still);
    }

    /// Cap the frame rate below the piece's own.
    pub fn set_max_fps(&self, fps: Option<f64>) {
        self.ctl(|c| c.max_fps = fps);
    }

    /// Redraw in another look (library pieces only).
    pub fn set_look(&self, look: impl Into<Look>) {
        let look = look.into();
        self.ctl(|c| c.look = Some(look));
    }

    /// Builder form of [`set_speed`](Player::set_speed).
    pub fn speed(self, speed: f64) -> Self {
        self.set_speed(speed);
        self
    }

    /// Builder form of [`set_still`](Player::set_still).
    pub fn still(self, still: bool) -> Self {
        self.set_still(still);
        self
    }

    /// Builder form of [`set_max_fps`](Player::set_max_fps).
    pub fn max_fps(self, fps: f64) -> Self {
        self.set_max_fps(Some(fps));
        self
    }

    /// Builder form of [`set_look`](Player::set_look).
    pub fn look(self, look: impl Into<Look>) -> Self {
        self.set_look(look);
        self
    }

    /// Start `t` seconds in.
    pub fn start_at(self, t: f64) -> Self {
        self.seek(t);
        self
    }
}

impl Drop for Player {
    fn drop(&mut self) {
        self.ctl_quiet(|c| c.stop = true);
        if let Some(t) = self.thread.take() {
            let _ = t.join();
        }
    }
}

impl std::fmt::Debug for Player {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Player")
            .field("slug", &self.meta.slug)
            .field("time", &self.time())
            .finish()
    }
}

fn run(sh: Arc<Shared>, make: Make, fps: f64) {
    let mut piece = match make() {
        Ok(p) => p,
        Err(e) => {
            *sh.error.lock().unwrap() = Some(e.to_string());
            return;
        }
    };
    let (mut t, mut last, mut advancing, mut drawn) = (0.0f64, Instant::now(), false, false);
    loop {
        let (look, speed, running, period) = {
            let mut c = sh.ctl.lock().unwrap();
            if c.stop {
                return;
            }
            if let Some(s) = c.seek.take() {
                t = s;
            }
            let dirty = std::mem::take(&mut c.dirty);
            let running = !c.paused && !c.still;
            if drawn && !running && !dirty {
                // Nothing moves: sleep until a control changes.
                advancing = false;
                let _c = sh
                    .wake
                    .wait_while(c, |c| !c.dirty && !c.stop && (c.paused || c.still))
                    .unwrap();
                continue;
            }
            let rate = c.max_fps.map_or(fps, |m| m.min(fps)).max(0.5);
            (
                c.look.take(),
                c.speed,
                running,
                Duration::from_secs_f64(1.0 / rate),
            )
        };
        let now = Instant::now();
        if advancing && running {
            t += (now - last).as_secs_f64() * speed;
        }
        (last, advancing) = (now, running);
        if let Some(l) = look {
            piece.set_look(&l);
        }
        let frame = piece.draw(t);
        *sh.error.lock().unwrap() = piece.error().map(str::to_string);
        *sh.frame.lock().unwrap() = Arc::new(frame);
        sh.time.store(t.to_bits(), Ordering::Release);
        sh.frame_id.fetch_add(1, Ordering::AcqRel);
        drawn = true;
        // Sleep out the rest of the frame, waking early for a control change.
        let left = period.saturating_sub(now.elapsed());
        let c = sh.ctl.lock().unwrap();
        if !c.dirty && !c.stop && !c.paused {
            let _ = sh
                .wake
                .wait_timeout_while(c, left, |c| !c.dirty && !c.stop && !c.paused)
                .unwrap();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn plays_pauses_and_stops() {
        let p = Player::from_slug("spinning-torus").unwrap();
        assert!(p.wait_ready(Duration::from_secs(5)), "{:?}", p.error());
        std::thread::sleep(Duration::from_millis(150));
        assert!(p.time() > 0.05);
        p.pause();
        std::thread::sleep(Duration::from_millis(60));
        let (id, t) = (p.frame_id(), p.time());
        std::thread::sleep(Duration::from_millis(120));
        assert_eq!(
            (p.frame_id(), p.time()),
            (id, t),
            "paused player keeps its frame"
        );
        p.resume();
        std::thread::sleep(Duration::from_millis(120));
        assert!(
            p.time() > t && p.time() < t + 0.5,
            "resumes without jumping"
        );
        p.seek(10.0);
        std::thread::sleep(Duration::from_millis(60));
        assert!(p.time() >= 10.0);
        assert!(matches!(
            Player::from_slug("spinning-toru"),
            Err(Error::UnknownPiece { .. })
        ));
    }
}
