/*
 * brand.js: the "brand" kind. A logo mask (coverage 0-8 and a colour key per cell,
 * made from an SVG or PNG by the studio CLI or a host's image helper) played with
 * an entrance effect, then a gentle idle loop, so one spec works as an intro and as
 * a header that stays on screen.
 *
 *   { kind: "brand", effect: "assemble", cols: 60, rows: 20, palette: {...},
 *     cov: ["0012...", ...], color: ["  00...", ...],
 *     duration: 2.2, idle: "shimmer", loop: 0, accent: "#ffffff" }
 *
 * Effects: reveal, draw, assemble, matrix, glitch, halftone, spin3d, shimmer.
 * Idles:   shimmer (default), still, pulse, rain.
 * loop: replay the whole thing every n seconds (0 = play once, then idle forever).
 */
import { FX, COVER, hash, easeOut, easeInOut, clamp01, layers, join, metaFor, mix, luma } from "./util.js";

export const BRAND_EFFECTS = ["reveal", "draw", "assemble", "matrix", "glitch", "halftone", "spin3d", "shimmer"];
export const BRAND_IDLES = ["shimmer", "still", "pulse", "rain"];

const RAIN = "0123456789ABCDEF<>+*=:";
const DOTS = " ·•●";
const SHADE = " ░▒▓█";

/** The palette with the effect colours filled in: accent (X), dim (Y), extra (Z). */
function fxPalette(spec) {
  const pal = { ...(spec.palette || { 0: "#ffffff" }) };
  const own = Object.keys(pal).filter((k) => k !== FX.accent && k !== FX.dim && k !== FX.extra);
  const brightest = own.reduce((a, k) => (luma(pal[k]) > luma(pal[a]) ? k : a), own[0]);
  if (!pal[FX.accent]) pal[FX.accent] = spec.accent || mix(pal[brightest], "#ffffff", 0.65);
  if (!pal[FX.dim]) pal[FX.dim] = spec.dim || mix(pal[brightest], "#000000", 0.6);
  if (!pal[FX.extra]) pal[FX.extra] = spec.extra || "#00e5ff";
  return pal;
}

export function brand(spec) {
  const W = spec.cols, H = spec.rows;
  const effect = BRAND_EFFECTS.includes(spec.effect) ? spec.effect : "reveal";
  const idle = BRAND_IDLES.includes(spec.idle) ? spec.idle : "shimmer";
  const D = effect === "shimmer" ? 0 : spec.duration > 0 ? spec.duration : 2.2;
  const loop = spec.loop > 0 ? Math.max(spec.loop, D + 0.5) : 0;
  const aspect = spec.square ? 1 : 1 / 0.602; // how much taller a cell is than wide
  const palette = fxPalette(spec);
  const meta = metaFor(spec, {
    cols: W, rows: H, fps: spec.fps || 30, palette,
    ...(spec.square ? { cell: "square" } : {}),
    ...(spec.look ? { look: spec.look } : {}),
  });

  // The mask, as a list of inked cells.
  const cov = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    const c = spec.cov[y] ? spec.cov[y].charCodeAt(x) - 48 : 0;
    return c > 0 && c <= 8 ? c : 0;
  }));
  // Optional: the character each cell settles on (ama-studio brand --style glyphs),
  // in place of the shading block its coverage gives.
  const chAt = (x, y) => { const c = spec.chars && spec.chars[y] && spec.chars[y][x]; return c && c !== " " ? c : null; };
  const keyAt = (x, y) => (spec.color[y] && spec.color[y][x] && spec.color[y][x] !== " " ? spec.color[y][x] : "0");
  const cells = [];
  let sx = 0, sy = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = cov[y][x];
    if (!c) continue;
    const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !(cov[y + dy] && cov[y + dy][x + dx]));
    cells.push({ x, y, c, k: keyAt(x, y), edge, i: cells.length, ch: chAt(x, y) });
    sx += x; sy += y;
  }
  const cx = cells.length ? sx / cells.length : W / 2, cy = cells.length ? sy / cells.length : H / 2;
  let maxDist = 1, minX = W, maxX = 0;
  for (const p of cells) {
    p.dist = Math.hypot(p.x - cx, (p.y - cy) * aspect);
    p.u = (p.x / W) * 0.75 + (p.y / H) * 0.25; // the diagonal a sweep follows
    if (p.dist > maxDist) maxDist = p.dist;
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
  }
  // The outline in order around the centre, for "draw".
  const outline = cells.filter((p) => p.edge).map((p) => [Math.atan2((p.y - cy) * aspect, p.x - cx), p]);
  outline.sort((a, b) => a[0] - b[0] || a[1].i - b[1].i);
  outline.forEach(([, p], n) => (p.order = n / Math.max(1, outline.length)));

  const put = (o, x, y, ch, k) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && y >= 0 && x < W && y < H) { o.T[y][x] = ch; o.C[y][x] = k; }
  };
  // A cell's glyph at coverage c: its own character once it is fully in, else shading.
  const glyph = (p, c) => (p.ch && c >= p.c ? p.ch : COVER[Math.min(8, c)]);
  const logo = (o, p, c = p.c, k = p.k) => { if (c > 0) put(o, p.x, p.y, glyph(p, c), k); };

  // ── idles: what plays once the entrance is over (t counts from its end) ──
  const IDLE = {
    still(o) { for (const p of cells) logo(o, p); },
    shimmer(o, t) {
      const every = 4.5, width = 0.07;
      const g = ((t % every) / every) * 1.7 - 0.35;
      for (const p of cells) {
        const d = Math.abs(p.u - g);
        if (d < width && p.c >= 3) put(o, p.x, p.y, d < width * 0.45 ? "█" : "▓", FX.accent);
        else logo(o, p);
      }
    },
    pulse(o, t) {
      for (const p of cells) {
        const w = Math.sin(t * 2.2 - p.dist * 0.25);
        logo(o, p, Math.max(1, Math.min(8, p.c + Math.round(w * 1.5))));
      }
    },
    rain(o, t) {
      rain(o, t + 1000, 0.35, false);
      for (const p of cells) logo(o, p);
    },
  };

  // Matrix rain. On the way in, every column's first drop locks the logo cells it passes.
  const colSpeed = (x) => {
    const off = hash(x, 2, 7) * H * 0.6;
    return [off, (H + off) / (Math.max(D, 0.5) * (0.4 + 0.4 * hash(x, 1, 7)))];
  };
  function rain(o, t, density, intro) {
    for (let x = 0; x < W; x++) {
      if (!intro && hash(x, 9, 7) > density) continue;
      const [off, v] = colSpeed(x);
      const trail = 5 + Math.floor(hash(x, 3, 7) * 8);
      const head = t * v - off;
      const period = H + trail + 4;
      const hy = intro ? head : ((head % period) + period) % period;
      for (let j = 0; j <= trail; j++) {
        const y = Math.floor(hy) - j;
        if (y < 0 || y >= H) continue;
        if (intro && cov[y][x]) continue; // drawn by the lock pass
        const ch = RAIN[Math.floor(hash(x, y, Math.floor(t * 12) + j) * RAIN.length)];
        put(o, x, y, ch, j === 0 ? FX.accent : FX.dim);
      }
    }
  }

  // ── entrances (t in 0..D) ──
  const ENTER = {
    reveal(o, t) {
      const front = easeInOut(t / D) * 1.25 - 0.1;
      for (const p of cells) {
        const d = front - p.u;
        if (d < 0) continue;
        if (d < 0.06) put(o, p.x, p.y, d < 0.025 ? "█" : "▓", FX.accent);
        else logo(o, p);
      }
    },
    draw(o, t) {
      const p1 = clamp01(t / (D * 0.6)), p2 = clamp01((t - D * 0.5) / (D * 0.5));
      for (const p of cells) {
        if (p.edge) {
          if (p.order > p1) continue;
          const head = p1 - p.order < 0.03 && p1 < 1;
          put(o, p.x, p.y, head ? "█" : p.ch || COVER[Math.max(4, p.c)], head || p2 < 0.5 ? FX.accent : p.k);
        } else if (p2 > 0) {
          const stage = clamp01(p2 * 1.6 - hash(p.x, p.y, 3) * 0.6);
          logo(o, p, Math.round(p.c * stage));
        }
      }
    },
    assemble(o, t) {
      const flying = [];
      for (const p of cells) {
        const delay = hash(p.x, p.y, 11) * 0.35;
        const k = easeOut((t / D - delay) / 0.65);
        if (k >= 1) { logo(o, p); continue; }
        if (k <= 0 && t / D < delay - 0.2) continue;
        const a = hash(p.x, p.y, 12) * Math.PI * 2, r = Math.max(W, H * aspect) * (0.6 + hash(p.x, p.y, 13) * 0.6);
        const x0 = cx + Math.cos(a) * r, y0 = cy + (Math.sin(a) * r) / aspect;
        flying.push([x0 + (p.x - x0) * k, y0 + (p.y - y0) * k, k]);
      }
      for (const [x, y, k] of flying) put(o, x, y, k > 0.7 ? "•" : "·", FX.accent);
    },
    matrix(o, t) {
      rain(o, t, 1, true);
      for (const p of cells) {
        const [off, v] = colSpeed(p.x);
        const lockT = (p.y + off) / v;
        if (t < lockT) continue;
        if (t - lockT < 0.15) put(o, p.x, p.y, "█", FX.accent);
        else logo(o, p);
      }
    },
    glitch(o, t) { glitch(o, t, 1 - (t / D) * 0.85, easeOut(t / (D * 0.5))); },
    halftone(o, t) {
      const r = easeOut(t / D) * maxDist * 1.15;
      for (const p of cells) {
        const a = clamp01((r - p.dist) / 3);
        if (a <= 0) continue;
        const wave = 0.75 + 0.25 * Math.sin(p.dist * 0.45 - t * 3);
        const i = Math.ceil(clamp01((p.c / 8) * a * wave) * (DOTS.length - 1));
        if (i > 0) put(o, p.x, p.y, DOTS[i], p.k);
      }
    },
    spin3d(o, t) { spin(o, (Math.PI / 2) * (1 - easeOut(t / D)), 1); },
    shimmer(o, t) { IDLE.shimmer(o, t); },
  };

  function glitch(o, t, intensity, visible) {
    const f = Math.floor(t * 14);
    for (const p of cells) {
      if (visible < 1 && hash(p.i, f, 5) > visible) continue;
      const band = Math.floor(p.y / 2);
      let x = p.x, k = p.k;
      if (hash(band, f, 1) < intensity * 0.35) x += Math.round((hash(band, f, 2) - 0.5) * intensity * W * 0.25);
      if (hash(band, f, 3) < intensity * 0.3) k = hash(band, f, 4) < 0.5 ? FX.extra : FX.accent;
      put(o, x, p.y, glyph(p, p.c), k);
    }
    const noise = Math.floor(intensity * cells.length * 0.04);
    for (let n = 0; n < noise; n++) put(o, hash(n, f, 6) * W, hash(n, f, 7) * H, hash(n, f, 8) < 0.5 ? "▓" : "░", FX.extra);
  }

  // The mask extruded into a slab and turned by angle a about the vertical axis.
  const depth = Math.max(1.5, (maxX - minX) * 0.08);
  function spin(o, a, shadeAll) {
    const zbuf = new Float64Array(W * H).fill(-Infinity);
    const ca = Math.cos(a), sa = Math.sin(a), dist = W * 1.5;
    const L = [-0.45, 0.35, 0.82];
    const plot = (wx, wy, wz, ch, k) => {
      const X = wx * ca + wz * sa, Z = -wx * sa + wz * ca, f = dist / (dist - Z);
      const x = Math.round(cx + X * f), y = Math.round(cy + (wy * f) / aspect);
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const i = x + y * W;
      if (Z <= zbuf[i]) return;
      zbuf[i] = Z; o.T[y][x] = ch; o.C[y][x] = k;
    };
    const front = Math.max(0.15, -sa * L[0] + ca * L[2]), back = Math.max(0.15, sa * L[0] - ca * L[2]);
    for (const p of cells) {
      const wx = p.x - cx, wy = (p.y - cy) * aspect;
      if (p.edge) for (let z = -depth + 0.5; z < depth; z += 0.5) plot(wx, wy, z, "▒", FX.dim);
      const lit = (b) => SHADE[Math.max(1, Math.min(4, Math.round((p.c / 8) * b * 4 * shadeAll + 0.4)))];
      // two samples per cell, so the near face has no gaps when perspective enlarges it
      for (const d of [-0.3, 0.3]) {
        plot(wx + d, wy, depth, lit(front), p.k);
        plot(wx + d, wy, -depth, lit(back), p.k);
      }
    }
  }

  return {
    meta,
    create() {
      return (t) => {
        if (loop) t %= loop;
        const o = layers(W, H);
        if (t < D) ENTER[effect](o, t);
        else if (effect === "spin3d" && idle === "shimmer") spin(o, Math.sin((t - D) * 0.8) * 0.35 * clamp01((t - D) / 1.5), 1);
        else IDLE[idle](o, t - D);
        return { text: join(o.T), color: join(o.C) };
      };
    },
  };
}
