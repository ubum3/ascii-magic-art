/*
 * fixtures.js: a fixed set of specs covering every kind and effect, drawn by Node
 * into packages/fixtures/extras-golden.bin (scripts/bundle-native.mjs) and checked
 * against QuickJS and goja by the Rust and Go parity tests.
 */
import { cellsFromPixels } from "../src/media.js";
import { BRAND_EFFECTS, BRAND_IDLES } from "../src/brand.js";
import { TEXT_EFFECTS } from "../src/text.js";

/** A ring with a bar through it: a stand-in logo, 2 colours, soft edges. */
export function testMask(W = 48, H = 16) {
  const cov = [], color = [];
  for (let y = 0; y < H; y++) {
    let c = "", k = "";
    for (let x = 0; x < W; x++) {
      const dx = (x - W / 2 + 0.5) / (W * 0.3), dy = (y - H / 2 + 0.5) / (H * 0.42);
      const r = Math.hypot(dx, dy);
      let v = Math.max(0, 1 - Math.abs(r - 0.8) / 0.22);
      if (Math.abs(dy) < 0.18 && Math.abs(dx) < 1.1) v = 1;
      const n = Math.max(0, Math.min(8, Math.round(v * 8)));
      c += n; k += n ? (Math.abs(dy) < 0.18 ? "1" : "0") : " ";
    }
    cov.push(c); color.push(k);
  }
  return { cols: W, rows: H, cov, color, palette: { 0: "#ff6a3d", 1: "#ffd23f" } };
}

/** A smooth hue and brightness sweep, w x h RGBA. */
export function testPixels(w = 32, h = 24) {
  const px = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (x + y * w) * 4, a = (x / w) * Math.PI * 2, v = 1 - y / h;
    px[i] = (128 + 127 * Math.cos(a)) * v; px[i + 1] = (128 + 127 * Math.cos(a - 2.1)) * v; px[i + 2] = (128 + 127 * Math.cos(a + 2.1)) * v; px[i + 3] = 255;
  }
  return px;
}

/** [name, spec, state?] for every kind, every effect and idle. */
export function fixtures() {
  const m = testMask();
  const out = [];
  for (const effect of BRAND_EFFECTS) out.push([`brand-${effect}`, { kind: "brand", effect, ...m }]);
  for (const idle of BRAND_IDLES) out.push([`brand-idle-${idle}`, { kind: "brand", effect: "reveal", idle, duration: 0.4, ...m }]);
  out.push(["brand-square", { kind: "brand", effect: "assemble", square: true, ...m }]);
  for (const effect of TEXT_EFFECTS) out.push([`text-${effect}`, { kind: "text", text: "Ship it 42!", effect }]);
  out.push(["text-plain-font", { kind: "text", text: "deploying main", font: "plain", effect: "typewriter" }]);
  const cells = cellsFromPixels(testPixels(), 32, 24, { colors: 24 });
  out.push(["image-still", { kind: "image", ...cells }]);
  out.push(["image-motion", { kind: "image", ...cells, motion: { glint: true, breathe: 0.3, twinkle: 0.5 } }]);
  out.push(["progress", { kind: "progress", cols: 36, label: "Settling" }, { value: 0.42, label: "Settling batch 7" }]);
  out.push(["sparkline", { kind: "sparkline", cols: 30, rows: 4, label: "TPS" }, { values: Array.from({ length: 50 }, (_, i) => 20 + Math.sin(i / 3) * 10) }]);
  out.push(["ticker", { kind: "ticker", cols: 50 }, { items: [{ label: "VOLUME", value: 1234567, delta: 2.4 }, { label: "AUTH", value: 98.2, delta: -0.3 }] }]);
  for (const style of ["check", "confetti", "fireworks"]) out.push([`celebrate-${style}`, { kind: "celebrate", cols: 40, rows: 12, message: "Payment approved", style }]);
  // Per-cell glyphs (ama-studio brand --style glyphs): edge characters where the mask is partial.
  const chars = m.cov.map((r) => [...r].map((c) => (c === "0" ? " " : c === "8" ? "8" : "/")).join(""));
  out.push(["brand-glyphs", { kind: "brand", effect: "draw", ...m, chars }]);
  return out;
}

/** The times every fixture is drawn at; the last frame is the one compared. */
export const TIMES = [0, 0.3, 0.7, 1.1, 1.5];
