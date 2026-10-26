/*
 * reduce.js: events to what the wall shows. Pure: the clock is the events' own ts
 * (ms), and tick(state, now) moves it on when nothing happens. view(state) is the
 * layout state for screen.js's regions.
 *
 *   let s = initial();
 *   s = reduce(s, { type: "auth", scheme: "visa", amount: 4210, currency: "USD", ts });
 *   s = tick(s, Date.now());
 *   player.setState(view(s));
 *
 * Bursts: one per card scheme at a time, at most MAX_BURSTS at once. An auth for a
 * scheme already bursting, or one over the cap, or any auth while one is playing and
 * the rate is above BUSY_RATE a second, is coalesced into the burst on screen
 * (its message counts them) instead of starting another.
 */
import { SCHEMES, burstId } from "./schemes.js";
import { BURST_SECONDS, PAYOUT_SECONDS } from "./screen.js";

export const BUCKETS = 120; // seconds kept; the sparkline shows the last 60
export const MAX_BURSTS = 3;
export const BUSY_RATE = 5;
const BURST_MS = BURST_SECONDS * 1000, PAYOUT_MS = PAYOUT_SECONDS * 1000;
const NBSP = "\u00a0";

export function initial(now = 0) {
  return {
    sec: Math.floor(now / 1000),
    auths: new Array(BUCKETS).fill(0),
    declines: new Array(BUCKETS).fill(0),
    volume: 0, count: 0, declined: 0, payouts: 0, payoutVolume: 0, refunds: 0, coalesced: 0,
    currency: "USD",
    recent: [], // ts of auths in the last second
    bursts: {}, // scheme -> { until, n, amount }
    play: {}, // region id -> counter
    payout: null, // { until, amount, currency }
  };
}

/** Move the clock to `now` (ms): buckets roll, finished bursts end. */
export function tick(s, now) {
  const sec = Math.floor(now / 1000);
  let out = s;
  if (sec > s.sec) {
    const shift = Math.min(BUCKETS, sec - s.sec), z = new Array(shift).fill(0);
    out = { ...out, sec, auths: [...s.auths.slice(shift), ...z], declines: [...s.declines.slice(shift), ...z] };
  }
  const live = Object.fromEntries(Object.entries(out.bursts).filter(([, b]) => b.until > now));
  if (Object.keys(live).length !== Object.keys(out.bursts).length) out = { ...out, bursts: live };
  if (out.payout && out.payout.until <= now) out = { ...out, payout: null };
  const recent = out.recent.filter((t) => t > now - 1000);
  if (recent.length !== out.recent.length) out = { ...out, recent };
  return out;
}

const bump = (s, sec, key) => {
  const i = BUCKETS - 1 - (s.sec - sec);
  if (i < 0 || i >= BUCKETS) return s[key];
  const a = s[key].slice();
  a[i]++;
  return a;
};

export function reduce(s, e) {
  if (!e || typeof e.ts !== "number") return s;
  s = tick(s, Math.max(e.ts, s.sec * 1000));
  const sec = Math.floor(e.ts / 1000);
  switch (e.type) {
    case "auth": {
      s = { ...s, auths: bump(s, sec, "auths"), count: s.count + 1, volume: s.volume + (e.amount || 0), currency: e.currency || s.currency, recent: [...s.recent, e.ts] };
      const scheme = Object.hasOwn(SCHEMES, e.scheme) ? e.scheme : null;
      if (!scheme) return s;
      const active = Object.keys(s.bursts), mine = s.bursts[scheme];
      const busy = s.recent.length > BUSY_RATE && active.length > 0;
      if (mine || active.length >= MAX_BURSTS || busy) {
        const into = mine ? scheme : active[0];
        if (!into) return { ...s, coalesced: s.coalesced + 1 };
        const b = s.bursts[into];
        return { ...s, coalesced: s.coalesced + 1, bursts: { ...s.bursts, [into]: { ...b, n: b.n + 1, amount: b.amount + (e.amount || 0) } } };
      }
      const id = burstId(scheme);
      return { ...s, bursts: { ...s.bursts, [scheme]: { until: e.ts + BURST_MS, n: 1, amount: e.amount || 0 } }, play: { ...s.play, [id]: (s.play[id] || 0) + 1 } };
    }
    case "decline":
      return { ...s, declines: bump(s, sec, "declines"), declined: s.declined + 1 };
    case "payout":
      return {
        ...s, payouts: s.payouts + 1, payoutVolume: s.payoutVolume + (e.amount || 0),
        payout: { until: e.ts + PAYOUT_MS, amount: e.amount || 0, currency: e.currency || s.currency },
        play: { ...s.play, payout: (s.play.payout || 0) + 1 },
      };
    case "refund":
      return { ...s, refunds: s.refunds + 1 };
    default:
      return s;
  }
}

const SYMBOL = { USD: "$", EUR: "€", GBP: "£", JPY: "¥", AUD: "A$", CAD: "C$" };
const ZERO_DECIMAL = new Set(["JPY", "KRW"]);
/** Minor units to "$42.10" (no Intl: the terminal engines lack it). */
export function money(minor, currency = "USD") {
  const zero = ZERO_DECIMAL.has(currency), v = zero ? minor : minor / 100;
  const [i, f] = Math.abs(v).toFixed(zero ? 0 : 2).split(".");
  const s = i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : "");
  return (v < 0 ? "-" : "") + (SYMBOL[currency] || currency + " ") + s;
}

const sum = (a) => a.reduce((x, y) => x + y, 0);
const rate = (ok, no) => (ok + no ? (100 * ok) / (ok + no) : 100);

/** The layout state: { regions: { id: state }, play: { id: n } }. */
export function view(s) {
  const half = BUCKETS / 2;
  const okNow = sum(s.auths.slice(half)), noNow = sum(s.declines.slice(half));
  const okBefore = sum(s.auths.slice(0, half)), noBefore = sum(s.declines.slice(0, half));
  const approval = rate(okNow, noNow), before = rate(okBefore, noBefore);
  const perSec = s.auths[BUCKETS - 2] || 0; // the last whole second
  const regions = {
    spark: { values: s.auths.slice(half), label: `Auths / s  ${perSec}` },
    approval: { value: approval / 100, label: `Approval ${approval.toFixed(1)}%` },
    ticker: {
      items: [
        { label: "VOLUME", value: money(s.volume, s.currency) },
        { label: "AUTHS", value: s.count },
        { label: "APPROVAL", value: approval.toFixed(1) + "%", delta: okBefore + noBefore ? approval - before : undefined },
        { label: "DECLINES", value: s.declined },
        { label: "PAYOUTS", value: `${s.payouts} · ${money(s.payoutVolume, s.currency)}` },
      ],
    },
  };
  // no-break spaces: a plain space in an overlay shows the chart under it
  const words = (...w) => w.filter(Boolean).join(NBSP);
  for (const [scheme, b] of Object.entries(s.bursts))
    regions[burstId(scheme)] = { message: words(SCHEMES[scheme].label, b.n > 1 && "×" + b.n, money(b.amount, s.currency)) };
  if (s.payout) regions.payout = { message: words("PAYOUT", money(s.payout.amount, s.payout.currency)) };
  // only what is playing now, so a screen that connects late doesn't replay old bursts
  const play = {};
  for (const scheme of Object.keys(s.bursts)) play[burstId(scheme)] = s.play[burstId(scheme)];
  if (s.payout) play.payout = s.play.payout;
  return { regions, play };
}
