/*
 * transition.js: one frame turning into another, cell by cell, and pieces played
 * one after another with a transition between each. The same kinds as the Rust
 * and Go packages: dissolve, wipe-right/left/down/up, melt, scramble, iris.
 *
 *   const show = sequence([logo, dashboard], { hold: 3, kind: "dissolve", duration: 0.8 });
 *   show.default()(t)    // a piece module like any other
 */
import { KEYS } from "ascii-magic-art/lib/kit.js";
import { hash } from "./util.js";

export const TRANSITIONS = ["dissolve", "wipe-right", "wipe-left", "wipe-down", "wipe-up", "melt", "scramble", "iris"];
const NOISE = "!<>-_/[]{}=+*^?#%&$@";
const smooth = (t) => { t = Math.max(0, Math.min(1, t)); return t * t * (3 - 2 * t); };

/** A frame as rows of [char, key], centred in w x h. */
function grid(f, w, h) {
  const str = typeof f === "string";
  const T = (str ? f : f.text).split("\n").map((r) => [...r]);
  const C = str ? null : f.color.split("\n").map((r) => [...r]);
  const fw = T[0] ? T[0].length : 0, ox = Math.floor((w - fw) / 2), oy = Math.floor((h - T.length) / 2);
  return Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => {
    const sy = y - oy, sx = x - ox;
    if (sy < 0 || sx < 0 || sy >= T.length || sx >= fw) return [" ", " "];
    return [T[sy][sx] || " ", (C && C[sy] && C[sy][sx]) || " "];
  }));
}

/**
 * Palettes of several pieces as one: the first keeps its keys, the others' colours
 * get new keys (a colour already there reuses its key). Returns { palette, maps }
 * where maps[i] turns piece i's keys into the shared ones.
 */
export function mergePalettes(palettes) {
  const palette = {}, byHex = new Map(), maps = [];
  let next = 0;
  const free = () => { while (next < KEYS.length && palette[KEYS[next]]) next++; return KEYS[next]; };
  palettes.forEach((p, i) => {
    const map = {};
    for (const [k, hex] of Object.entries(p || {})) {
      const h = hex.toLowerCase();
      if (byHex.has(h)) { map[k] = byHex.get(h); continue; }
      const key = i === 0 && !palette[k] ? k : free();
      if (!key) { map[k] = " "; continue; } // out of keys: default ink
      palette[key] = hex; byHex.set(h, key); map[k] = key;
    }
    maps.push(map);
  });
  return { palette, maps };
}

/** Mix frame a into frame b at p (0..1). Both are centred in w x h; keys are mapped with mapA/mapB. */
export function mixFrames(kind, a, b, p, w, h, mapA = {}, mapB = {}) {
  const A = grid(a, w, h), B = grid(b, w, h);
  const text = [], color = [];
  const q = smooth(p);
  for (let y = 0; y < h; y++) {
    let tr = "", cr = "";
    for (let x = 0; x < w; x++) {
      const fx = x + 0.5, fy = y + 0.5;
      let from = A[y][x], to = B[y][x], c = from, useTo = false;
      switch (kind) {
        case "wipe-right": case "wipe-left": case "wipe-down": case "wipe-up": {
          const [u, n] = kind === "wipe-right" ? [fx, w] : kind === "wipe-left" ? [w - fx, w] : kind === "wipe-down" ? [fy, h] : [h - fy, h];
          const front = q * (n + 2) - 1;
          if (u < front - 1) useTo = true;
          else if (u < front) { c = ["█", to[1]]; useTo = "edge"; }
          break;
        }
        case "scramble": {
          const k = hash(x, y, 3), s = q * 1.3;
          if (k < s - 0.3) useTo = true;
          else if (k < s) { c = [NOISE[Math.floor(hash(x, y, Math.floor(p * 30)) * NOISE.length)], to[1]]; useTo = "edge"; }
          break;
        }
        case "melt": {
          const k = Math.max(0, Math.min(1, (p - hash(x, 0, 11) * 0.35) / 0.65));
          const sy = y - Math.floor(k * k * (h + 2));
          if (sy >= 0) c = A[sy][x]; else useTo = true;
          break;
        }
        case "iris": {
          const r = q * (Math.hypot(w / 2, h / 2 / 0.602) + 1);
          if (Math.hypot(fx - w / 2, (fy - h / 2) / 0.602) < r) useTo = true;
          break;
        }
        default: // dissolve
          if (hash(x, y, 7) < q) useTo = true;
      }
      if (useTo === true) c = to;
      const key = c[1] === " " ? " " : (useTo ? mapB[c[1]] : mapA[c[1]]) ?? c[1];
      tr += c[0]; cr += key;
    }
    text.push(tr); color.push(cr);
  }
  return { text: text.join("\n"), color: color.join("\n") };
}

/**
 * Pieces one after another. Each plays for `hold` seconds (a number, or one per
 * piece), then turns into the next over `duration` seconds. loop: start again after
 * the last (default true). Every piece keeps its own clock from when it appears.
 */
export function sequence(pieces, { hold = 3, kind = "dissolve", duration = 0.8, loop = true } = {}) {
  const holds = pieces.map((_, i) => (Array.isArray(hold) ? hold[i] ?? 3 : hold));
  const W = Math.max(...pieces.map((p) => p.meta.cols)), H = Math.max(...pieces.map((p) => p.meta.rows));
  const { palette, maps } = mergePalettes(pieces.map((p) => p.meta.palette));
  const starts = [];
  let total = 0;
  holds.forEach((s, i) => { starts.push(total); total += s + (i < pieces.length - 1 || loop ? duration : 0); });
  const meta = {
    slug: "sequence", name: pieces.map((p) => p.meta.name).join(" → "), category: "extras", note: "", tags: ["extras", "sequence"],
    cols: W, rows: H, fps: Math.max(...pieces.map((p) => p.meta.fps || 24)), palette,
  };
  const create = () => {
    const draws = pieces.map((p) => p.default());
    return (t, state) => {
      if (loop) t = ((t % total) + total) % total;
      let i = 0;
      while (i + 1 < pieces.length && t >= starts[i + 1]) i++;
      const local = t - starts[i], j = (i + 1) % pieces.length;
      const fa = draws[i](local, state);
      if (local < holds[i] || (!loop && i === pieces.length - 1)) return mixFrames("dissolve", fa, fa, 0, W, H, maps[i], maps[i]);
      const p = (local - holds[i]) / duration;
      return mixFrames(kind, fa, draws[j](local - holds[i], state), p, W, H, maps[i], maps[j]);
    };
  };
  return { meta, default: create };
}
