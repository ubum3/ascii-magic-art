/*
 * text.js: the "text" kind. A word or two in a 5-row block font (or plain text),
 * with an entrance and an idle loop.
 *
 *   { kind: "text", text: "DEPLOYED", effect: "scramble", font: "block",
 *     colors: ["#ffffff", "#7ee787", "#3a3f4b"], shadow: true, duration: 1.6 }
 *
 * Effects: typewriter, wave, rainbow, scramble, glitch, plain.
 * colors: main, accent, shadow. cols/rows default to the text's size plus padding.
 */
import { palette as kitPalette, hsl, KEYS } from "ascii-magic-art/lib/kit.js";
import { FX, hash, easeOut, clamp01, layers, join, metaFor } from "./util.js";

export const TEXT_EFFECTS = ["typewriter", "wave", "rainbow", "scramble", "glitch", "plain"];

// 5-row block font. Lower case draws as upper case; unknown characters as a space.
const G = {
  A: [" ### ", "#   #", "#####", "#   #", "#   #"], B: ["#### ", "#   #", "#### ", "#   #", "#### "],
  C: [" ####", "#    ", "#    ", "#    ", " ####"], D: ["#### ", "#   #", "#   #", "#   #", "#### "],
  E: ["#####", "#    ", "#### ", "#    ", "#####"], F: ["#####", "#    ", "#### ", "#    ", "#    "],
  G: [" ####", "#    ", "#  ##", "#   #", " ####"], H: ["#   #", "#   #", "#####", "#   #", "#   #"],
  I: ["###", " # ", " # ", " # ", "###"], J: ["  ###", "   # ", "   # ", "#  # ", " ##  "],
  K: ["#   #", "#  # ", "###  ", "#  # ", "#   #"], L: ["#    ", "#    ", "#    ", "#    ", "#####"],
  M: ["#   #", "## ##", "# # #", "#   #", "#   #"], N: ["#   #", "##  #", "# # #", "#  ##", "#   #"],
  O: [" ### ", "#   #", "#   #", "#   #", " ### "], P: ["#### ", "#   #", "#### ", "#    ", "#    "],
  Q: [" ### ", "#   #", "# # #", "#  # ", " ## #"], R: ["#### ", "#   #", "#### ", "#  # ", "#   #"],
  S: [" ####", "#    ", " ### ", "    #", "#### "], T: ["#####", "  #  ", "  #  ", "  #  ", "  #  "],
  U: ["#   #", "#   #", "#   #", "#   #", " ### "], V: ["#   #", "#   #", "#   #", " # # ", "  #  "],
  W: ["#   #", "#   #", "# # #", "## ##", "#   #"], X: ["#   #", " # # ", "  #  ", " # # ", "#   #"],
  Y: ["#   #", " # # ", "  #  ", "  #  ", "  #  "], Z: ["#####", "   # ", "  #  ", " #   ", "#####"],
  0: [" ### ", "#  ##", "# # #", "##  #", " ### "], 1: [" # ", "## ", " # ", " # ", "###"],
  2: ["#### ", "    #", " ### ", "#    ", "#####"], 3: ["#### ", "    #", " ### ", "    #", "#### "],
  4: ["#   #", "#   #", "#####", "    #", "    #"], 5: ["#####", "#    ", "#### ", "    #", "#### "],
  6: [" ### ", "#    ", "#### ", "#   #", " ### "], 7: ["#####", "    #", "   # ", "  #  ", "  #  "],
  8: [" ### ", "#   #", " ### ", "#   #", " ### "], 9: [" ### ", "#   #", " ####", "    #", " ### "],
  " ": ["   ", "   ", "   ", "   ", "   "], ".": [" ", " ", " ", " ", "#"], ",": ["  ", "  ", "  ", " #", "# "],
  "!": ["#", "#", "#", " ", "#"], "?": ["### ", "   #", " ## ", "    ", " #  "], ":": [" ", "#", " ", "#", " "],
  "-": ["   ", "   ", "###", "   ", "   "], "+": ["   ", " # ", "###", " # ", "   "], "_": ["    ", "    ", "    ", "    ", "####"],
  "/": ["    #", "   # ", "  #  ", " #   ", "#    "], "%": ["#   #", "   # ", "  #  ", " #   ", "#   #"],
  "#": [" # # ", "#####", " # # ", "#####", " # # "], "'": ["#", "#", " ", " ", " "],
  "(": [" #", "# ", "# ", "# ", " #"], ")": ["# ", " #", " #", " #", "# "], "=": ["   ", "###", "   ", "###", "   "],
  "$": [" ####", "# #  ", " ### ", "  # #", "#### "], "&": [" ##  ", "#  # ", " ## #", "#  # ", " ## #"],
  "@": [" ### ", "# ###", "# # #", "# ###", " ### "], "*": ["     ", "# # #", " ### ", "# # #", "     "],
};

/**
 * The text as pixels: [{x, y, n}] where n is which character it belongs to, plus
 * the size in cells. Each character's pixels are listed together, left to right.
 */
export function layout(text, font = "block") {
  const px = [];
  if (font === "plain") {
    [...text].forEach((c, n) => { if (c !== " ") px.push({ x: n, y: 0, n, ch: c }); });
    return { px, w: [...text].length, h: 1, count: [...text].length };
  }
  let x = 0, n = 0;
  for (const c of String(text).toUpperCase()) {
    const g = G[c] || G[" "];
    for (let y = 0; y < 5; y++) for (let i = 0; i < g[y].length; i++) if (g[y][i] === "#") px.push({ x: x + i, y, n, ch: "█" });
    x += g[0].length + 1; n++;
  }
  return { px, w: Math.max(0, x - 1), h: 5, count: n };
}

const NOISE = "!<>-_\\/[]{}=+*^?#%&$@";
const HUES = 12;

export function text(spec) {
  const str = String(spec.text == null ? "" : spec.text);
  const font = spec.font === "plain" ? "plain" : "block";
  const effect = TEXT_EFFECTS.includes(spec.effect) ? spec.effect : "scramble";
  const { px, w, h, count } = layout(str, font);
  const shadow = spec.shadow !== false && font === "block";
  const lift = effect === "wave" ? 2 : 0;
  const W = Math.max(spec.cols || 0, w + 4 + (shadow ? 1 : 0));
  const H = Math.max(spec.rows || 0, h + 2 + lift + (shadow ? 1 : 0));
  const ox = Math.floor((W - w - (shadow ? 1 : 0)) / 2), oy = Math.floor((H - h - (shadow ? 1 : 0)) / 2);
  const [main, accent, dim] = [...(spec.colors || []), "#ffffff", "#7ee787", "#3a3f4b"].filter(Boolean).slice(0, 3);
  const hues = Array.from({ length: HUES }, (_, i) => hsl((i * 360) / HUES, 85, 62));
  const palette = { ...kitPalette([main]), ...Object.fromEntries(hues.map((c, i) => [KEYS[10 + i], c])), [FX.accent]: accent, [FX.dim]: dim, [FX.extra]: "#00e5ff" };
  const D = spec.duration > 0 ? spec.duration : effect === "typewriter" ? Math.max(0.6, count * 0.09) : 1.6;
  const loop = spec.loop > 0 ? Math.max(spec.loop, D + 0.5) : 0;
  const meta = metaFor(spec, { cols: W, rows: H, fps: spec.fps || 30, palette });

  return {
    meta,
    create() {
      return (t) => {
        if (loop) t %= loop;
        const o = layers(W, H);
        const f = Math.floor(t * 14);
        const put = (x, y, ch, k) => { if (x >= 0 && y >= 0 && x < W && y < H) { o.T[y][x] = ch; o.C[y][x] = k; } };
        const shown = effect === "typewriter" ? Math.floor((t / D) * count) : count;
        const glitchOn = effect === "glitch" && (t < D ? hash(f, 1, 9) < 1 - t / D : hash(Math.floor(t / 3.2), 2, 9) < 0.5 && t % 3.2 < 0.25);
        // shadow first, then the letters over it
        if (shadow) for (const p of px) if (p.n < shown) put(ox + p.x + 1, oy + lift + p.y + 1, "░", FX.dim);
        for (const p of px) {
          if (p.n >= shown) continue;
          let x = ox + p.x, y = oy + lift + p.y, ch = p.ch, k = "0";
          if (effect === "wave") y += Math.round(Math.sin(t * 4 - p.x * 0.35) * (t < D ? easeOut(t / D) : 1) * 1);
          if (effect === "rainbow") k = KEYS[10 + ((Math.floor(p.x / 2 + t * 8) % HUES) + HUES) % HUES];
          if (effect === "scramble") {
            const at = (p.x / Math.max(1, w)) * D * 0.7 + hash(p.x, p.y, 4) * D * 0.3;
            if (t < at) { if (t > at - D * 0.5) { ch = NOISE[Math.floor(hash(p.x, p.y, f) * NOISE.length)]; k = FX.accent; } else continue; }
            else if (t - at < 0.08) k = FX.accent;
          }
          if (glitchOn) {
            const band = p.y;
            if (hash(band, f, 1) < 0.4) x += Math.round((hash(band, f, 2) - 0.5) * 6);
            if (hash(band, f, 3) < 0.3) k = hash(band, f, 5) < 0.5 ? FX.extra : FX.accent;
          }
          if (effect === "typewriter" && p.n === shown - 1 && t < D) k = FX.accent;
          put(x, y, ch, k);
        }
        // the typewriter's cursor: a block after the last letter, blinking
        if (effect === "typewriter" && Math.floor(t * 2.5) % 2 === 0) {
          const last = px.filter((p) => p.n < shown).reduce((m, p) => Math.max(m, p.x), -2);
          const cx = ox + last + 2;
          for (let y = 0; y < h; y++) put(cx, oy + y, font === "plain" ? "▌" : "█", FX.accent);
        }
        return { text: join(o.T), color: join(o.C) };
      };
    },
  };
}
