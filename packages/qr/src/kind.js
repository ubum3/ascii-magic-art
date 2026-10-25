/*
 * kind.js: the "qr" spec kind. A QR code that makes an entrance and then settles
 * into a scannable code in half blocks, two modules a cell (▀ ▄ █ and space).
 *
 *   { kind: "qr", text: "https://pay.example/r/42", effect: "assemble", ecc: "M" }
 *
 * The frame inks the LIGHT modules, so the dark modules are the background the
 * host paints under it (a terminal, the web player's canvas, an export). The quiet
 * zone is light and always drawn, so the code carries its own light surround.
 *
 * Scannability rules, enforced here:
 *   - quiet zone of at least 4 modules (spec.quiet, default 4)
 *   - `dark` (the background you will show it on) at most a quarter of the
 *     luminance of `light`; anything closer throws
 *   - from `settle` seconds on, every frame is exactly the static code: no idle
 *   - a centre logo only at ECC "H", and covering at most 15% of the modules
 *
 * Deterministic: no Math.random, no clock, so Node, QuickJS and goja draw the same
 * frames. Plain ES2017 once bundled.
 */
import { QrCode, QrSegment } from "./vendor/qrcodegen.js";

export const QR_EFFECTS = ["assemble", "reveal", "matrix", "glitch", "none"];
export const QR_ECC = { L: "LOW", M: "MEDIUM", Q: "QUARTILE", H: "HIGH" };

const hash = (x, y = 0, n = 0) => {
  let h = (x * 374761393 + y * 668265263 + n * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (t) => 1 - Math.pow(1 - clamp01(t), 3);
const linear = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
/** Relative luminance (WCAG) of a #rrggbb colour. */
export const luminance = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => linear(parseInt(hex.slice(i, i + 2), 16)));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/**
 * The module matrix for some text: { size, version, ecc, dark(x, y) }.
 * opts.ecc is L, M, Q or H (default M); opts.version is the smallest version to use.
 * ECC is raised for free when the data still fits the same version.
 */
export function qrMatrix(text, opts = {}) {
  const level = QR_ECC[opts.ecc || "M"];
  if (!level) throw new Error(`qr: ecc must be one of ${Object.keys(QR_ECC).join(", ")}, not ${JSON.stringify(opts.ecc)}`);
  const min = Math.max(1, Math.min(40, opts.version || 1));
  const code = QrCode.encodeSegments(QrSegment.makeSegments(String(text)), QrCode.Ecc[level], min, 40, -1, opts.boost !== false);
  const ecc = Object.keys(QR_ECC).find((k) => QrCode.Ecc[QR_ECC[k]] === code.errorCorrectionLevel);
  const rows = [];
  for (let y = 0; y < code.size; y++) { const r = []; for (let x = 0; x < code.size; x++) r.push(code.getModule(x, y)); rows.push(r); }
  return { size: code.size, version: code.version, ecc, dark: (x, y) => rows[y][x] };
}

/** A spec to { meta, create }, like every extras kind. */
export function qr(spec) {
  const text = spec.text != null ? spec.text : spec.url;
  if (text == null || text === "") throw new Error("qr: needs text (or url)");
  const quiet = Math.max(4, spec.quiet | 0 || 4);
  const light = spec.light || "#f4f4f5", dark = spec.dark || "#09090b";
  const accent = spec.accent || "#3fb950", ghost = spec.ghost || "#2f6f3e";
  if (luminance(dark) > luminance(light) / 4) {
    throw new Error(`qr: dark ${dark} is too close to light ${light}; dark must be at most a quarter of light's luminance`);
  }
  const effect = QR_EFFECTS.includes(spec.effect) ? spec.effect : "assemble";
  const settle = effect === "none" || spec.still ? 0 : spec.settle > 0 ? spec.settle : 1.5;
  const fps = spec.fps || 30;

  const m = qrMatrix(text, { ecc: spec.logo ? "H" : spec.ecc, version: spec.version });
  if (spec.logo && spec.ecc && spec.ecc !== "H") throw new Error("qr: a logo needs ecc H");
  const N = m.size + quiet * 2;
  const W = N, H = Math.ceil(N / 2);

  // The settled code as module values: true = light. Outside the matrix is quiet zone.
  const lit = Array.from({ length: H * 2 }, (_, y) => Array.from({ length: W }, (_, x) => {
    const mx = x - quiet, my = y - quiet;
    return !(mx >= 0 && my >= 0 && mx < m.size && my < m.size && m.dark(mx, my));
  }));

  // A centre logo: a dark box on whole cells with the text in it.
  let logo = null;
  if (spec.logo) {
    const label = String(spec.logo).slice(0, 12);
    const bw = label.length + 2, bh = 3;
    if (bw * bh * 2 > 0.15 * m.size * m.size) throw new Error(`qr: logo "${label}" covers more than 15% of the code; shorten it or use a longer text`);
    const bx = Math.floor((W - bw) / 2), by = Math.floor((H - bh) / 2);
    logo = { label, bx, by, bw, bh };
  }

  const palette = { 0: light, 1: accent, 2: ghost, 3: light };
  const meta = {
    slug: spec.slug || "qr", name: spec.name || "QR code", category: "extras",
    note: spec.note || `QR version ${m.version}, ECC ${m.ecc}, ${m.size} modules plus a ${quiet}-module quiet zone.`,
    tags: ["extras", "qr"], cols: W, rows: H, fps, palette,
    qr: { version: m.version, ecc: m.ecc, size: m.size, quiet, settle, dark, light },
    ...(settle === 0 ? { still: true } : {}),
  };

  // Module values: 0 off (background), 1 light, 2 accent, 3 ghost.
  const MOD = [" ", "0", "1", "2"];
  function compose(V) {
    const T = [], C = [];
    for (let r = 0; r < H; r++) {
      let tr = "", cr = "";
      for (let x = 0; x < W; x++) {
        const a = V[r * 2][x], b = V[r * 2 + 1][x];
        tr += a && b ? "█" : a ? "▀" : b ? "▄" : " ";
        // one colour a cell: the entrance colours win over light
        cr += a || b ? MOD[Math.max(a, b)] : " ";
      }
      T.push(tr); C.push(cr);
    }
    if (logo) {
      for (let y = logo.by; y < logo.by + logo.bh; y++) {
        const t = [...T[y]], c = [...C[y]];
        for (let x = logo.bx; x < logo.bx + logo.bw; x++) {
          const ch = y === logo.by + 1 && x > logo.bx && x <= logo.bx + logo.label.length ? logo.label[x - logo.bx - 1] : " ";
          t[x] = ch; c[x] = ch === " " ? " " : "3";
        }
        T[y] = t.join(""); C[y] = c.join("");
      }
    }
    return { text: T.join("\n"), color: C.join("\n") };
  }

  const settled = compose(lit.map((row) => row.map((v) => (v ? 1 : 0))));
  const blank = () => Array.from({ length: H * 2 }, () => new Array(W).fill(0));

  const EFFECTS = {
    // Every light module flies in from a scattered spot, accent until it lands.
    assemble(p) {
      const V = blank();
      for (let y = 0; y < H * 2; y++) for (let x = 0; x < W; x++) {
        if (!lit[y][x]) continue;
        const delay = hash(x, y, 1) * 0.45, k = easeOut((p - delay) / 0.5);
        if (k <= 0) continue;
        const sx = hash(x, y, 2) * W, sy = hash(x, y, 3) * H * 2;
        const px = Math.round(sx + (x - sx) * k), py = Math.round(sy + (y - sy) * k);
        if (px >= 0 && py >= 0 && px < W && py < H * 2) V[py][px] = Math.max(V[py][px], k >= 1 ? 1 : 2);
      }
      return V;
    },
    // A diagonal wipe with a ragged accent front.
    reveal(p) {
      const V = blank();
      for (let y = 0; y < H * 2; y++) for (let x = 0; x < W; x++) {
        const d = ((x + y) / (W + H * 2)) * 0.85 + hash(x, y, 4) * 0.15, f = p * 1.12 - d;
        if (f < 0) continue;
        V[y][x] = f < 0.07 ? 3 : lit[y][x] ? 1 : 0;
        if (f < 0.07 && lit[y][x]) V[y][x] = 2;
      }
      return V;
    },
    // Rain down each column; the code is left behind where the drop has passed.
    matrix(p, t) {
      const V = blank(), tick = Math.floor(t * fps / 2);
      for (let x = 0; x < W; x++) {
        const head = (p * 1.35 - hash(x, 0, 5) * 0.35) * (H * 2 + 8);
        for (let y = 0; y < H * 2; y++) {
          if (y < head - 6) V[y][x] = lit[y][x] ? 1 : 0;
          else if (y <= head) V[y][x] = hash(x, y, tick) < 0.55 ? (y > head - 1 ? 2 : 3) : 0;
        }
      }
      return V;
    },
    // The whole code, flipped and torn at random, calming down to exact.
    glitch(p, t) {
      const V = blank(), tick = Math.floor(t * 12), k = 0.5 * Math.sqrt(1 - p);
      for (let r = 0; r < H; r++) {
        const tear = hash(r, tick, 6) < k * 0.6 ? Math.round((hash(r, tick, 7) - 0.5) * 10 * k) : 0;
        for (let yy = 0; yy < 2; yy++) {
          const y = r * 2 + yy;
          for (let x = 0; x < W; x++) {
            const sx = x - tear, v = sx >= 0 && sx < W ? lit[y][sx] : false;
            const flip = hash(x, y, tick + 8) < k;
            V[y][x] = flip ? (v ? 0 : 2) : v ? 1 : 0;
          }
        }
      }
      return V;
    },
  };

  return {
    meta,
    create() {
      return (t) => {
        if (!(t < settle)) return settled;
        const p = clamp01(t / settle);
        return compose(EFFECTS[effect](p, t));
      };
    },
  };
}
