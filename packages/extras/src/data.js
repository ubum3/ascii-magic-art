/*
 * data.js: kinds that draw your data as well as time. The host passes the latest
 * state with every frame: draw(t, state). Missing state falls back to the spec.
 *
 *   progress   { value: 0..1, label }                  a bar that eases to the value
 *   sparkline  { values: number[], label }             the last `cols` values, bars in eighths
 *   ticker     { items: [{ label, value, delta }] }    a scrolling marquee, ▲ green, ▼ red
 *   celebrate  { message, style: check|confetti|fireworks|coins }   "payment approved", "deployed"
 *
 * The spec sets the size (cols, rows) and colours. Frames depend on the order of
 * draw calls only through easing, and are otherwise pure in (t, state).
 */
import { palette as kitPalette, hsl, KEYS } from "ascii-magic-art/lib/kit.js";
import { FX, hash, easeOut, clamp01, layers, join, metaFor } from "./util.js";

const EIGHTHS = " ▏▎▍▌▋▊▉█";
const BARS = " ▁▂▃▄▅▆▇█";

const fmt = (v) => {
  if (typeof v !== "number") return String(v);
  const a = Math.abs(v);
  return a >= 1e6 ? (v / 1e6).toFixed(1) + "M" : a >= 1e4 ? (v / 1e3).toFixed(1) + "k" : a >= 100 ? v.toFixed(0) : String(Math.round(v * 100) / 100);
};

function frame(o) { return { text: join(o.T), color: join(o.C) }; }
function writer(o, W, H) {
  return {
    put(x, y, ch, k = "0") { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < W && y < H) { o.T[y][x] = ch; o.C[y][x] = k; } },
    text(x, y, s, k = "0") { [...s].forEach((c, i) => this.put(x + i, y, c, k)); },
  };
}

export function progress(spec) {
  const W = spec.cols || 40, H = spec.rows || 2;
  const [bar, track, ink] = [...(spec.colors || []), "#7ee787", "#30363d", "#c9d1d9"].slice(0, 3);
  const palette = { ...kitPalette([bar, track, ink]), [FX.accent]: spec.accent || "#ffffff", [FX.dim]: "#8b949e" };
  const meta = metaFor(spec, { cols: W, rows: H, fps: spec.fps || 30, palette });
  return {
    meta,
    create() {
      let shown = null, last = null;
      return (t, state) => {
        const s = { value: spec.value || 0, label: spec.label || "", ...(state || {}) };
        const target = clamp01(Number(s.value) || 0);
        const dt = last == null ? 0 : Math.max(0, Math.min(0.5, t - last));
        last = t;
        shown = shown == null ? target : shown + (target - shown) * (1 - Math.exp(-dt * 8));
        if (Math.abs(target - shown) < 0.0005) shown = target;
        const o = layers(W, H), w = writer(o, W, H);
        const by = H - 1;
        if (H > 1) {
          const done = shown >= 1;
          const pct = done ? "✓ done" : Math.round(shown * 100) + "%";
          w.text(0, by - 1, String(s.label).slice(0, Math.max(0, W - pct.length - 1)), "2");
          w.text(W - pct.length, by - 1, pct, done ? FX.accent : "2");
        }
        const cells = shown * W, full = Math.floor(cells);
        const glint = ((t * 0.6) % 1.4 - 0.2) * W;
        for (let x = 0; x < W; x++) {
          if (x < full) w.put(x, by, "█", Math.abs(x - glint) < 1.5 && shown < 1 ? FX.accent : "0");
          else if (x === full && cells - full > 0) w.put(x, by, EIGHTHS[Math.max(1, Math.round((cells - full) * 8))], "0");
          else w.put(x, by, "█", "1");
        }
        return frame(o);
      };
    },
  };
}

export function sparkline(spec) {
  const W = spec.cols || 40, H = spec.rows || 4;
  const stops = spec.colors && spec.colors.length ? spec.colors : ["#1f6feb", "#58a6ff", "#a5d6ff"];
  const palette = { ...kitPalette(stops), [FX.accent]: spec.accent || "#ffd86b", [FX.dim]: "#8b949e" };
  const meta = metaFor(spec, { cols: W, rows: H, fps: spec.fps || 30, palette });
  return {
    meta,
    create() {
      let sig = "", since = 0;
      return (t, state) => {
        const s = { values: spec.values || [], label: spec.label || "", ...(state || {}) };
        const vals = (s.values || []).map(Number).filter((v) => isFinite(v));
        const key = vals.length + ":" + vals[vals.length - 1];
        if (key !== sig) { sig = key; since = t; }
        const o = layers(W, H), w = writer(o, W, H);
        const top = s.label ? 1 : 0, rows = H - top, show = vals.slice(-W);
        if (s.label) {
          const last = show.length ? fmt(show[show.length - 1]) : "";
          w.text(0, 0, String(s.label).slice(0, W - last.length - 1), FX.dim);
          w.text(W - last.length, 0, last, FX.accent);
        }
        if (show.length) {
          let lo = Math.min(...show), hi = Math.max(...show);
          if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
          const x0 = W - show.length;
          show.forEach((v, i) => {
            let lv = ((v - lo) / (hi - lo)) * (rows * 8 - 1) + 1;
            const newest = i === show.length - 1;
            if (newest) lv *= easeOut((t - since) / 0.35);
            for (let r = 0; r < rows; r++) {
              const fill = Math.max(0, Math.min(8, Math.round(lv - r * 8)));
              if (!fill) continue;
              const k = newest ? FX.accent : KEYS[Math.min(stops.length - 1, Math.floor((r / rows) * stops.length))];
              w.put(x0 + i, top + rows - 1 - r, BARS[fill], k);
            }
          });
        }
        return frame(o);
      };
    },
  };
}

export function ticker(spec) {
  const W = spec.cols || 60, H = spec.rows || 1, speed = spec.speed || 8;
  const palette = { ...kitPalette(["#c9d1d9", "#3fb950", "#f85149"]), [FX.accent]: spec.accent || "#ffffff", [FX.dim]: "#484f58" };
  const meta = metaFor(spec, { cols: W, rows: H, fps: spec.fps || 30, palette });
  return {
    meta,
    create() {
      return (t, state) => {
        const items = ((state && state.items) || spec.items || []).map((it) => (typeof it === "object" ? it : { label: String(it) }));
        const run = []; // [char, key]
        const add = (s, k) => { for (const c of s) run.push([c, k]); };
        for (const it of items) {
          add(it.label || "", FX.accent);
          if (it.value != null) add(" " + fmt(it.value), "0");
          if (it.delta != null) { const up = it.delta >= 0; add(" " + (up ? "▲" : "▼") + Math.abs(it.delta).toFixed(1) + "%", up ? "1" : "2"); }
          add("   ·   ", FX.dim);
        }
        const o = layers(W, H), w = writer(o, W, H);
        if (run.length) {
          const off = Math.floor(t * speed);
          const y = Math.floor((H - 1) / 2);
          for (let x = 0; x < W; x++) { const [c, k] = run[(((x + off) % run.length) + run.length) % run.length]; if (c !== " ") w.put(x, y, c, k); }
        }
        return frame(o);
      };
    },
  };
}

const GOLDS = ["#ffd23f", "#f5b700", "#ffe58a", "#e09f1f"];
const COINS = "◎¢$", SPIN = "◎○|○";

export function celebrate(spec) {
  const W = spec.cols || 40, H = spec.rows || 12, aspect = 1 / 0.602;
  // spec.hues recolours the confetti, fireworks and coins; coins default to golds.
  const own = spec.hues && spec.hues.length ? spec.hues : spec.style === "coins" ? GOLDS : null;
  const hues = Array.from({ length: 8 }, (_, i) => (own ? own[i % own.length] : hsl(i * 45, 90, 62)));
  const palette = { ...kitPalette([spec.color || "#3fb950", "#c9d1d9", ...hues]), [FX.accent]: spec.accent || "#ffffff", [FX.dim]: "#484f58" };
  const meta = metaFor(spec, { cols: W, rows: H, fps: spec.fps || 30, palette });
  const SPARK = "*+·•°";
  const seed = (spec.seed | 0) * 7919; // another seed, other positions (0 keeps the originals)
  return {
    meta,
    create() {
      return (t, state) => {
        const s = { message: spec.message || "", style: spec.style || "check", ...(state || {}) };
        const o = layers(W, H), w = writer(o, W, H);
        const msg = String(s.message);
        const cx = (W - 1) / 2, my = H - 1, cy = msg ? (H - 2) / 2 : (H - 1) / 2;
        const confetti = (n, burst) => {
          for (let i = 0; i < n; i++) {
            const k = KEYS[2 + (i % 8)], ch = SPARK[i % SPARK.length];
            if (burst) {
              const life = t - 0.45;
              if (life < 0 || life > 2.4) continue;
              const a = hash(i + seed, 1, 21) * Math.PI * 2, v = 6 + hash(i + seed, 2, 21) * 14;
              w.put(cx + Math.cos(a) * v * life, cy + (Math.sin(a) * v * life) / aspect + 4 * life * life, ch, k);
            } else {
              const sp = 3 + hash(i + seed, 3, 21) * 6, x = hash(i + seed, 4, 21) * W + Math.sin(t * 2 + i) * 1.5;
              const y = ((t * sp + hash(i + seed, 5, 21) * H * 2) % (H + 4)) - 2;
              w.put(x, y, ch, k);
            }
          }
        };
        if (s.style === "confetti") confetti(Math.floor(W * H * 0.06), false);
        else if (s.style === "fireworks") {
          for (let b = 0; b < 3; b++) {
            const per = 1.8, ph = t + b * 0.6, n = Math.floor(ph / per), life = ph % per;
            const bx = W * (0.2 + hash(n + seed, b, 22) * 0.6), byy = H * (0.2 + hash(n + seed, b, 23) * 0.4), k = KEYS[2 + ((n + b) % 8)];
            for (let i = 0; i < 18; i++) {
              const a = (i / 18) * Math.PI * 2, r = easeOut(life / 1.2) * Math.min(W / 4, 10);
              if (life > 1.5) continue;
              w.put(bx + Math.cos(a) * r, byy + (Math.sin(a) * r) / aspect + life * life, life > 1 ? "·" : "*", k);
            }
          }
        } else if (s.style === "coins") {
          // coins rain down spinning, bounce once and settle along the floor
          const floor = msg ? H - 3 : H - 1, n = Math.max(8, Math.floor(W * 0.6));
          for (let i = 0; i < n; i++) {
            const k = KEYS[2 + (i % 8)], x = Math.floor(hash(i + seed, 1, 24) * W);
            const life = t - hash(i + seed, 2, 24) * 1.4;
            if (life < 0) continue;
            const g = 9 + hash(i + seed, 3, 24) * 6, fall = Math.sqrt((floor + 1) / g * 2), y = -1 + 0.5 * g * life * life;
            if (life < fall) { w.put(x, y, SPIN[Math.floor(life * 14 + i) % SPIN.length], k); continue; }
            const b = life - fall, hop = 0.5;
            w.put(x, b < hop ? floor - Math.round(Math.sin((b / hop) * Math.PI) * 1.5) : floor, COINS[i % COINS.length], k);
          }
        } else {
          // a ring that draws itself, then a check stroked into it, then a burst
          const R = Math.max(2, Math.min(W / 2 - 2, ((H - (msg ? 3 : 1)) / 2) * aspect));
          const ring = easeOut(t / 0.5), n = Math.ceil(R * 8);
          for (let i = 0; i < n * ring; i++) {
            const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
            w.put(cx + Math.cos(a) * R, cy + (Math.sin(a) * R) / aspect, "●", "0");
          }
          const pts = [[-0.45, 0.05], [-0.12, 0.38], [0.48, -0.32]];
          const stroke = clamp01((t - 0.4) / 0.4) * 2;
          for (let seg = 0; seg < 2; seg++) {
            const k = clamp01(stroke - seg);
            const [ax, ay] = pts[seg], [bx, byy] = pts[seg + 1];
            for (let j = 0; j <= 20 * k; j++) {
              const u = j / 20;
              w.put(cx + (ax + (bx - ax) * u) * R, cy + ((ay + (byy - ay) * u) * R) / aspect, "█", FX.accent);
            }
          }
          confetti(24, true);
        }
        if (msg) {
          const shown = Math.floor(clamp01((t - 0.7) / Math.max(0.3, msg.length * 0.04)) * msg.length);
          w.text(Math.floor((W - msg.length) / 2), my, msg.slice(0, shown), "1");
        }
        return frame(o);
      };
    },
  };
}
