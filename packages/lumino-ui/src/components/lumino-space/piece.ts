/* lumino-space: deep space for a background. A nebula, twinkling dust, and Lumino brandmarks for stars, drifting by in parallax, spinning and glinting. */
import { Grid, RAMPS, ramp, rng, fbm, palette, gradient, hsl, KEYS, TAU, definePiece } from "ascii-magic-art-react/kit";
import { MASK } from "../lumino-donut/mask.js";

const NEBULA = gradient(["#1a1a48", "#3a2470", "#2c4f8f"], 3); // keys 0-2 (few shades keep the server HTML small)
const DUST = ["#2e3760", "#5d6b9c", "#b8c6ec", "#ffffff"]; // keys 3-6
const GLASS = gradient(["#3b4670", "#8090c0", "#d4defa", "#ffffff"], 8); // keys 7-14: the brandmarks
const HUES = 24; // keys 15-38: rainbow glints on the big brandmarks' edges
const RAINBOW = Array.from({ length: HUES }, (_, i) => hsl((i * 360) / HUES, 90, 70));
const N0 = 0, D0 = 3, G0 = 7, R0 = 15;
const COLS = 160, ROWS = 56;

/** One loop, in seconds. Every drift, spin and twinkle is a whole number of turns of it. */
export const LUMINO_SPACE_PERIOD = 120;

export const luminoSpace = definePiece(
  {
    slug: "lumino-space", name: "Lumino Space", category: "space", cols: COLS, rows: ROWS, fps: 24,
    note: "Deep space for a background: a nebula, twinkling dust, and Lumino brandmarks for stars, drifting by in parallax, spinning and glinting.",
    palette: palette([...NEBULA, ...DUST, ...GLASS, ...RAINBOW]),
  },
  () => {
    const g = new Grid(COLS, ROWS);
    const P = LUMINO_SPACE_PERIOD, w = TAU / P; // w: one turn per loop
    const rand = rng(7);
    const pick = (a: number, b: number) => a + rand() * (b - a);
    const int = (a: number, b: number) => Math.floor(pick(a, b + 1));

    // A summed-area table of the mask: the coverage of any rectangle of it in O(1).
    const M = MASK.length, sat = new Float64Array((M + 1) * (M + 1));
    for (let y = 0; y < M; y++) for (let x = 0; x < M; x++)
      sat[(y + 1) * (M + 1) + x + 1] = (MASK[y][x] === "#" ? 1 : 0) + sat[y * (M + 1) + x + 1] + sat[(y + 1) * (M + 1) + x] - sat[y * (M + 1) + x];
    const cover = (x0: number, y0: number, x1: number, y1: number) => {
      const c = (v: number) => Math.max(0, Math.min(M, Math.round(v)));
      x0 = c(x0); y0 = c(y0); x1 = Math.max(c(x1), x0 + 1); y1 = Math.max(c(y1), y0 + 1);
      if (x0 >= M || y0 >= M) return 0;
      const s = sat[y1 * (M + 1) + x1] - sat[y0 * (M + 1) + x1] - sat[y1 * (M + 1) + x0] + sat[y0 * (M + 1) + x0];
      return s / ((x1 - x0) * (y1 - y0));
    };

    // The nebula is fixed; it only breathes.
    const neb = new Float32Array(COLS * ROWS);
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const v = fbm(x / 30, y / 13, 5, 3), band = Math.exp(-(((y / ROWS - 0.35 - (x / COLS) * 0.3) / 0.28) ** 2)); // a diagonal band
      neb[x + y * COLS] = Math.max(0, (v - 0.42) * 2.4) * (0.35 + band);
    }

    // Dust: single characters in three depths. Speeds are whole screens per loop, so it wraps seamlessly.
    const dust = Array.from({ length: 170 }, () => {
      const layer = int(1, 3);
      return { x: pick(0, COLS), y: pick(0, ROWS), layer, tw: int(8, 40), ph: pick(0, TAU), b: pick(0.2, 1) * (0.4 + layer * 0.2) };
    });

    // Brandmark stars: width in columns, laps of the screen per loop, spins per loop.
    const SPAN = COLS + 30; // they wrap a little off screen, so the big ones slide in and out
    const stars = [
      ...Array.from({ length: 12 }, () => ({ w: int(5, 7), laps: 1, b: 0.45 })),
      ...Array.from({ length: 7 }, () => ({ w: int(9, 13), laps: 2, b: 0.7 })),
      ...Array.from({ length: 3 }, () => ({ w: int(17, 23), laps: 3, b: 1 })),
    ].map((s) => ({ ...s, x: pick(0, SPAN), y: pick(4, ROWS - 4), bob: pick(0.5, 2), bobN: int(2, 5), spin: int(9, 18), ph: pick(0, TAU), hue: rand() }));

    // A shooting brandmark: one pass every 20 s, lasting 1.6 s.
    const EVERY = 20, FLY = 1.6;
    const shots = Array.from({ length: P / EVERY }, () => ({ x: pick(0.15, 0.85) * COLS, y: pick(2, ROWS * 0.4), dx: pick(-1, 1) < 0 ? -1 : 1 }));

    const glass = (v: number) => KEYS[G0 + Math.max(0, Math.min(7, Math.floor(v * 8)))];

    /** A brandmark centred at cx, cy, w columns wide, turned so its width is scaled by s (negative: seen from behind). */
    const brandmark = (cx: number, cy: number, wd: number, s: number, bright: number, hue: number, t: number) => {
      const h = wd * 0.602, sw = wd * Math.max(0.06, Math.abs(s));
      const x0 = Math.floor(cx - sw / 2), x1 = Math.ceil(cx + sw / 2), y0 = Math.floor(cy - h / 2), y1 = Math.ceil(cy + h / 2);
      const glint = wd >= 17; // smaller ones are all edge, so they stay clear glass
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        let u0 = (x - cx) / sw + 0.5, u1 = (x + 1 - cx) / sw + 0.5;
        if (s < 0) [u0, u1] = [1 - u1, 1 - u0];
        const v = cover(u0 * M, ((y - cy) / h + 0.5) * M, u1 * M, ((y + 1 - cy) / h + 0.5) * M);
        if (v < 0.08) continue;
        const lum = bright * (0.55 + 0.45 * Math.abs(s));
        const edge = glint && v < 0.6;
        const co = edge ? KEYS[R0 + Math.floor((((hue + (u0 + u1) * 0.25 + t * w * 4) % 1) + 1) % 1 * HUES) % HUES] : glass(lum * (0.4 + v * 0.6));
        g.set(x, y, ramp(0.15 + v * lum * 0.85, RAMPS.soft), co);
      }
      // Facing you, a big one flares with a cross of light.
      const flare = Math.abs(s) > 0.94 && wd >= 9 ? (Math.abs(s) - 0.94) / 0.06 : 0;
      if (flare > 0) {
        const len = Math.round(flare * wd * 0.9);
        for (let i = 1; i <= len; i++) {
          const f = 1 - i / (len + 1), co = KEYS[D0 + Math.min(3, Math.floor(f * 4))];
          g.set(cx + sw / 2 + i, cy, f > 0.5 ? "-" : "·", co); g.set(cx - sw / 2 - i - 1, cy, f > 0.5 ? "-" : "·", co);
          if (i <= len / 3) { g.set(cx, cy - h / 2 - i, f > 0.5 ? "|" : "·", co); g.set(cx, cy + h / 2 + i - 1, f > 0.5 ? "|" : "·", co); }
        }
      }
    };

    const wrap = (v: number, n: number) => ((v % n) + n) % n;

    return (t) => {
      g.clear();
      const breathe = 0.85 + 0.15 * Math.sin(t * w * 6);
      for (let i = 0; i < COLS * ROWS; i++) {
        const v = neb[i] * breathe;
        if (v < 0.06) continue;
        g.set(i % COLS, Math.floor(i / COLS), ramp(Math.min(0.99, v * 0.55), " .,:;"), KEYS[N0 + Math.min(2, Math.floor(v * 2.2))]);
      }
      for (const d of dust) {
        const x = wrap(d.x - (t / P) * COLS * d.layer, COLS);
        const tw = d.b * (0.55 + 0.45 * Math.sin(t * w * d.tw + d.ph));
        g.set(x, d.y, tw > 0.75 ? "+" : tw > 0.45 ? "·" : ".", KEYS[D0 + Math.min(3, Math.floor(tw * 4))]);
      }
      for (const s of stars) {
        const x = wrap(s.x - (t / P) * SPAN * s.laps, SPAN) - 15;
        const y = s.y + s.bob * Math.sin(t * w * s.bobN + s.ph);
        brandmark(x, y, s.w, Math.cos(t * w * s.spin + s.ph), s.b, s.hue, t);
      }
      const k = Math.floor(wrap(t, P) / EVERY), age = wrap(t, P) - k * EVERY;
      if (age < FLY) {
        const sh = shots[k], p = age / FLY, x = sh.x + sh.dx * p * 60, y = sh.y + p * 18;
        for (let i = 1; i < 22; i++) {
          const f = 1 - i / 22;
          g.set(x - sh.dx * i * 2.2, y - i * 0.66, f > 0.66 ? "=" : f > 0.33 ? "-" : ".", KEYS[R0 + ((k * 7 + i) % HUES)]);
        }
        brandmark(x, y, 7, 1, 1 - p * 0.4, 0, t);
      }
      return g.frame();
    };
  },
);
