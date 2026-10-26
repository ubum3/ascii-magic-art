/*
 * mock.js: a seeded stream of made-up payments, for demos and tests. The same seed
 * gives the same events: arrivals are Poisson at `rate` a second, a share of them
 * declined, and a payout every so often.
 *
 *   for (const e of mockEvents({ seed: 7, until: 60_000 })) ...   // a minute, as data
 *   const stop = mockSource({ seed: 7 }, (e) => wall.push(e));     // live, on timers
 */
import { SCHEME_IDS } from "../schemes.js";

const MIX = { visa: 0.52, mastercard: 0.31, amex: 0.11, discover: 0.06 };

/** mulberry32: a small seeded PRNG, 0..1. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Events from `start` (ms) on, with increasing ts. Stops at `until` (ms), or never.
 *   rate: arrivals a second (default 3); approval: share approved (0.96);
 *   payoutEvery: mean seconds between payouts (20); mix: scheme shares; currency.
 */
export function* mockEvents({ seed = 1, start = 0, until = Infinity, rate = 3, approval = 0.96, payoutEvery = 20, mix = MIX, currency = "USD" } = {}) {
  const r = rng(seed);
  const schemes = SCHEME_IDS.filter((s) => mix[s] > 0), total = schemes.reduce((a, s) => a + mix[s], 0);
  const pick = () => {
    let u = r() * total;
    for (const s of schemes) if ((u -= mix[s]) < 0) return s;
    return schemes[schemes.length - 1];
  };
  // ticket sizes: mostly small, a long tail, in cents
  const amount = () => Math.round(Math.exp(2.6 + r() * 2.2 + (r() < 0.05 ? 2 : 0)) * 100);
  const gap = (perSec) => (-Math.log(1 - r()) / perSec) * 1000;
  let ts = start, nextPayout = start + gap(1 / payoutEvery);
  for (;;) {
    ts += gap(rate);
    while (nextPayout <= ts) {
      if (nextPayout >= until) return;
      yield { type: "payout", amount: Math.round((5000 + r() * 45000) * 100), currency, ts: Math.round(nextPayout) };
      nextPayout += gap(1 / payoutEvery);
    }
    if (ts >= until) return;
    const scheme = pick();
    yield r() < approval
      ? { type: "auth", scheme, amount: amount(), currency, ts: Math.round(ts) }
      : { type: "decline", scheme, amount: amount(), currency, ts: Math.round(ts) };
  }
}

const STALE_MS = 5000;

/**
 * Plays mockEvents in real time from now. Returns stop(). Events more than a few
 * seconds late (the machine slept, say) are dropped rather than replayed at once.
 */
export function mockSource(opts, onEvent, { now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  const it = mockEvents({ ...opts, start: now() });
  let timer, stopped = false;
  const next = () => {
    let r = it.next();
    while (!r.done && r.value.ts < now() - STALE_MS) r = it.next();
    if (r.done || stopped) return;
    const value = r.value;
    timer = setTimer(() => { if (value.ts >= now() - STALE_MS) onEvent(value); next(); }, Math.max(0, value.ts - now()));
  };
  next();
  return () => { stopped = true; clearTimer(timer); };
}
