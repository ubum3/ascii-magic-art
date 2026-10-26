/*
 * event.js: the only fields a wall event may carry. Everything that arrives from
 * outside (webhooks, an upstream SSE feed) goes through sanitize(), which builds a
 * new object from enums and numbers: no free text, so no PAN, name or email can
 * reach a screen or the /events stream, whatever the sender puts in.
 */
import { SCHEMES } from "../schemes.js";

export const TYPES = ["auth", "decline", "payout", "refund"];
const MAX_AMOUNT = 1e12; // minor units
const SKEW_MS = 5 * 60 * 1000;

/** A clean event, or null. `now` fills in a missing ts. */
export function sanitize(e, now = Date.now()) {
  if (!e || typeof e !== "object" || !TYPES.includes(e.type)) return null;
  const out = { type: e.type };
  const scheme = typeof e.scheme === "string" ? e.scheme.toLowerCase() : "";
  if (Object.hasOwn(SCHEMES, scheme)) out.scheme = scheme;
  const amount = Number(e.amount);
  if (Number.isFinite(amount) && amount >= 0 && amount <= MAX_AMOUNT) out.amount = Math.round(amount);
  if (typeof e.currency === "string" && /^[A-Za-z]{3}$/.test(e.currency)) out.currency = e.currency.toUpperCase();
  const ts = Number(e.ts);
  // a clock far off (or none) would scroll the charts: use ours
  out.ts = Number.isFinite(ts) && Math.abs(ts - now) < SKEW_MS ? Math.round(ts) : now;
  return out;
}

/** A body of one event, an array, or { events: [...] }, to clean events. */
export function sanitizeAll(body, now = Date.now()) {
  const list = Array.isArray(body) ? body : body && Array.isArray(body.events) ? body.events : [body];
  return list.slice(0, 1000).map((e) => sanitize(e, now)).filter(Boolean);
}
