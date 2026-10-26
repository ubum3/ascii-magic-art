/*
 * layout.js: the "layout" kind. Several specs on one screen: each region is a spec
 * placed at x, y in a cols x rows grid, drawn in order, later ones on top. A space
 * in a region lets what is under it show through, so a celebration can play over a
 * chart. Palettes are merged (mergePalettes), so the screen is one piece with one
 * palette and one state, and plays in every host that plays a spec.
 *
 *   { kind: "layout", cols: 96, rows: 28, drift: 1,
 *     regions: [
 *       { id: "tps", x: 2, y: 2, w: 60, h: 8, spec: { kind: "sparkline", label: "Auths / s" } },
 *       { id: "visa", x: 0, y: 0, w: 96, h: 28, play: 2.4, spec: { kind: "celebrate", style: "fireworks" } },
 *     ] }
 *
 * State: { regions: { id: state }, play: { id: n } }. Each region draws its own state.
 * A region with `play` (seconds) is hidden until play[id] takes a new value, then
 * plays from its start for that long: bump the number to fire it again. Its clock is
 * the layout's, so the host never needs to know when a burst began.
 * `opaque` clears the region's cells before it draws. `drift` moves everything up to
 * that many cells over a few minutes, against burn-in on screens that stay on.
 */
import { make } from "./index.js";
import { mergePalettes } from "./transition.js";
import { layers, join, metaFor } from "./util.js";

const DRIFT_PERIOD = 240;

function blit(o, f, r, map, dx, dy, W, H) {
  const plain = typeof f === "string";
  const T = (plain ? f : f.text).split("\n"), C = plain ? null : f.color.split("\n");
  const fh = T.length, fw = Math.max(0, ...T.map((row) => [...row].length));
  // centred in the region; a larger frame is cut evenly at the region's edges
  const ox = r.x + Math.floor((r.w - fw) / 2) + dx, oy = r.y + Math.floor((r.h - fh) / 2) + dy;
  const x0 = r.x + dx, y0 = r.y + dy;
  for (let j = 0; j < fh; j++) {
    const y = oy + j;
    if (y < y0 || y >= y0 + r.h || y < 0 || y >= H) continue;
    const ts = [...T[j]], cs = C ? [...(C[j] || "")] : [];
    for (let i = 0; i < ts.length; i++) {
      const x = ox + i, ch = ts[i];
      if (ch === " " || x < x0 || x >= x0 + r.w || x < 0 || x >= W) continue;
      const k = cs[i];
      o.T[y][x] = ch;
      o.C[y][x] = k && k !== " " ? map[k] || " " : " ";
    }
  }
}

export function layoutKind(spec) {
  const W = spec.cols, H = spec.rows;
  if (!(W > 0 && H > 0)) throw new Error("layout: cols and rows are required");
  const regions = (spec.regions || []).map((r, i) => {
    const x = r.x || 0, y = r.y || 0;
    const w = r.w > 0 ? r.w : W - x, h = r.h > 0 ? r.h : H - y;
    // a region's size is the default size of its spec; kinds that size themselves keep theirs
    const piece = make({ cols: w, rows: h, ...r.spec });
    return { id: r.id != null ? String(r.id) : String(i), x, y, w, h, play: r.play > 0 ? r.play : 0, opaque: !!r.opaque, piece };
  });
  const { palette, maps } = mergePalettes(regions.map((r) => r.piece.meta.palette));
  const fps = spec.fps || Math.max(24, ...regions.map((r) => r.piece.meta.fps || 0));
  const drift = typeof spec.drift === "object" && spec.drift ? spec.drift : { cells: spec.drift || 0 };
  const period = drift.period > 0 ? drift.period : DRIFT_PERIOD;
  const meta = metaFor(spec, { cols: W, rows: H, fps, palette, ...(spec.square ? { cell: "square" } : {}) });
  return {
    meta,
    create() {
      const draws = regions.map((r) => r.piece.create());
      const seen = regions.map(() => undefined), start = regions.map(() => 0);
      return (t, state) => {
        const st = (state && state.regions) || {}, play = (state && state.play) || {};
        const o = layers(W, H);
        const a = drift.cells || 0;
        const dx = Math.round(a * Math.sin((2 * Math.PI * t) / period)), dy = Math.round(a * Math.sin((2 * Math.PI * t) / (period * 1.618)));
        regions.forEach((r, i) => {
          let lt = t;
          if (r.play) {
            const n = play[r.id];
            if (n != null && n !== seen[i]) { seen[i] = n; start[i] = t; }
            if (seen[i] === undefined) return;
            lt = t - start[i];
            if (lt < 0 || lt >= r.play) return;
          }
          if (r.opaque) {
            for (let y = Math.max(0, r.y + dy); y < Math.min(H, r.y + dy + r.h); y++)
              for (let x = Math.max(0, r.x + dx); x < Math.min(W, r.x + dx + r.w); x++) { o.T[y][x] = " "; o.C[y][x] = " "; }
          }
          blit(o, draws[i](lt, st[r.id]), r, maps[i], dx, dy, W, H);
        });
        return { text: join(o.T), color: join(o.C) };
      };
    },
  };
}
