/*
 * screen.js: the default wall, as one extras "layout" spec sized to the screen.
 *
 *   title                                      (row 1)
 *   auths / s sparkline          | approval bar
 *                                | payouts: coins rain here
 *   fireworks over the middle, one region per card scheme
 *   ticker                                     (second last row)
 *
 * Region ids are the keys reduce.js's view() fills in.
 */
import { SCHEMES, SCHEME_IDS, burstId } from "./schemes.js";

/** Seconds a burst and a payout play for. reduce.js uses the same numbers. */
export const BURST_SECONDS = 2.4;
export const PAYOUT_SECONDS = 3.2;

export function wallLayout({ cols = 96, rows = 28, title = "LIVE PAYMENTS", drift = 1 } = {}) {
  cols = Math.max(40, Math.floor(cols));
  rows = Math.max(14, Math.floor(rows));
  const midY = 3, midH = rows - 6;
  const sparkW = Math.floor((cols - 6) * 0.62), rightX = 2 + sparkW + 2, rightW = cols - rightX - 2;
  return {
    kind: "layout", slug: "wall", name: "Payments wall", cols, rows, drift, fps: 30,
    regions: [
      { id: "title", x: 2, y: 1, w: cols - 4, h: 1, spec: { kind: "text", text: title, font: "plain", effect: "plain", colors: ["#e6edf3"] } },
      { id: "spark", x: 2, y: midY, w: sparkW, h: midH, spec: { kind: "sparkline", label: "Auths / s", colors: ["#1f6feb", "#58a6ff", "#a5d6ff"] } },
      { id: "approval", x: rightX, y: midY + 1, w: rightW, h: 2, spec: { kind: "progress", label: "Approval", colors: ["#3fb950", "#30363d", "#c9d1d9"] } },
      { id: "ticker", x: 1, y: rows - 2, w: cols - 2, h: 1, spec: { kind: "ticker", speed: 6 } },
      { id: "payout", x: rightX, y: midY + 4, w: rightW, h: Math.max(4, midH - 4), play: PAYOUT_SECONDS, spec: { kind: "celebrate", style: "coins", seed: 9 } },
      ...SCHEME_IDS.map((s, i) => ({
        // one row shorter each, so two bursts' messages don't print over each other
        id: burstId(s), x: 1, y: midY - 1, w: cols - 2, h: midH + 1 - i, play: BURST_SECONDS,
        spec: { kind: "celebrate", style: "fireworks", hues: SCHEMES[s].hues, color: SCHEMES[s].hues[0], seed: i + 1 },
      })),
    ],
  };
}
