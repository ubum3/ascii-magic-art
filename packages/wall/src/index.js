/*
 * ascii-magic-art-wall: a live payments wall. Events become one extras "layout"
 * spec's state, which React, ratatui and Bubble Tea all play.
 *
 *   import { wallLayout, initial, reduce, tick, view, mockEvents } from "ascii-magic-art-wall";
 *   const spec = wallLayout({ cols: 96, rows: 28 });
 *   let s = initial();
 *   for (const e of mockEvents({ seed: 1, until: 10_000 })) s = reduce(s, e);
 *   draw(t, view(tick(s, 10_000)));
 */
export { wallLayout, BURST_SECONDS, PAYOUT_SECONDS } from "./screen.js";
export { initial, reduce, tick, view, money, MAX_BURSTS, BUSY_RATE, BUCKETS } from "./reduce.js";
export { SCHEMES, SCHEME_IDS, burstId } from "./schemes.js";
export { mockEvents, mockSource, rng } from "./sources/mock.js";
export { sanitize, sanitizeAll, TYPES } from "./sources/event.js";
export { sseParser, sseSource } from "./sources/sse.js";
