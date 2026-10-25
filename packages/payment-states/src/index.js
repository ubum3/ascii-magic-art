/*
 * ascii-magic-art-payment-states: a payment, payout, onboarding or terminal
 * status to the piece that shows it. The table is src/states.json, which the Go
 * and Rust packages embed too (scripts/sync.mjs copies it), so every host agrees.
 *
 *   import { normalise, resolveState } from "ascii-magic-art-payment-states";
 *   normalise("AUTHORISATION", { success: false });  // "declined"
 *   normalise("payment_intent.succeeded");           // "authorised"
 *   resolveState("payout-sent");
 *   // { status: "payout-sent", tone: "ok", label: "Payout sent", slug: "empty-inbox-plane" }
 *
 * React: ascii-magic-art-payment-states/react has <PaymentState status="..."/>.
 */
import TABLE from "./states.json" with { type: "json" };

export { TABLE };
/** Every status, in table order. */
export const STATUSES = Object.keys(TABLE.states);
export const TONES = TABLE.tones;

const ALIAS = {};
for (const [status, names] of Object.entries(TABLE.aliases)) for (const n of names) ALIAS[n] = status;

const key = (code) => String(code).trim().toLowerCase().replace(/[\s_]+/g, "-");
const flag = (v) => (v === true || v === "true" ? true : v === false || v === "false" ? false : undefined);

/**
 * A status name, an alias, or a PSP event code to one of STATUSES, or null.
 * opts.success is the event's success flag (Adyen sends AUTHORISATION with
 * success true or false); for event codes in TABLE.outcomes it picks the outcome.
 * Case, spaces and underscores don't matter; "x.succeeded" falls back to "succeeded".
 */
export function normalise(code, opts = {}) {
  if (code == null || code === "") return null;
  const k = key(code), ok = flag(opts.success);
  if (ok !== undefined && TABLE.outcomes[k]) return TABLE.outcomes[k][ok ? 0 : 1];
  if (TABLE.states[k]) return k;
  if (ALIAS[k]) return ALIAS[k];
  const tail = k.slice(k.lastIndexOf(".") + 1);
  if (tail !== k) return TABLE.states[tail] ? tail : ALIAS[tail] || null;
  return null;
}
export { normalise as normalize };

/**
 * A status (or anything normalise() takes) to what shows it:
 * { status, tone, label, slug?, spec?, caption? }. A slug is a library piece, a
 * spec an extras spec, and a caption a small text spec to show under the art.
 * Throws on an unknown status, unless opts.fallback names a status to use instead.
 */
export function resolveState(status, opts = {}) {
  const s = normalise(status, opts) || (opts.fallback && normalise(opts.fallback));
  if (!s) throw new Error(`unknown payment status ${JSON.stringify(status)}: one of ${STATUSES.join(", ")}, or an alias in states.json`);
  const e = TABLE.states[s];
  return { status: s, tone: e.tone, label: e.label, ...(e.slug ? { slug: e.slug } : {}), ...(e.spec ? { spec: e.spec } : {}), ...(e.caption ? { caption: e.caption } : {}) };
}
