/*
 * webhook.js: a POST endpoint for payment events, signed with a shared secret.
 *
 *   X-Wall-Signature: t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">
 *
 * The same scheme as most payment webhooks: the timestamp is signed with the body,
 * and one older than `tolerance` seconds is refused, so a captured request can't be
 * replayed later. The body (one event, an array, or { events }) is passed through
 * sanitize(), so only the allowed fields go any further.
 */
import crypto from "node:crypto";
import { sanitizeAll } from "./event.js";

export const SIGNATURE_HEADER = "x-wall-signature";
const MAX_BODY = 64 * 1024;

/** The header value for a body, as a sender would compute it. */
export function sign(secret, body, t = Math.floor(Date.now() / 1000)) {
  const mac = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return `t=${t},v1=${mac}`;
}

/** True when the header signs the body with the secret, within tolerance seconds of now. */
export function verify(secret, body, header, { tolerance = 300, now = Date.now() } = {}) {
  if (!secret || typeof header !== "string") return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.trim().split("=", 2)));
  const t = Number(parts.t), v1 = parts.v1;
  if (!Number.isInteger(t) || !/^[0-9a-f]{64}$/.test(v1 || "")) return false;
  if (Math.abs(now / 1000 - t) > tolerance) return false;
  const want = crypto.createHmac("sha256", secret).update(`${t}.${body}`).digest();
  return crypto.timingSafeEqual(want, Buffer.from(v1, "hex"));
}

/**
 * A node:http handler for the webhook. Calls onEvents with the clean events of a
 * request that verifies; answers 204, or 400, 401, 405 or 413.
 */
export function webhookHandler({ secret, onEvents, tolerance, now = Date.now }) {
  if (!secret) throw new Error("a webhook needs a secret (--secret or WALL_SECRET)");
  return (req, res) => {
    if (req.method !== "POST") { res.writeHead(405, { allow: "POST" }).end(); return; }
    const chunks = [];
    let size = 0, over = false;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) { over = true; req.destroy(); return; }
      chunks.push(c);
    });
    req.on("close", () => { if (over && !res.headersSent) res.writeHead(413).end(); });
    req.on("end", () => {
      if (over) return;
      const body = Buffer.concat(chunks).toString("utf8");
      if (!verify(secret, body, req.headers[SIGNATURE_HEADER], { tolerance, now: now() })) { res.writeHead(401).end(); return; }
      let parsed;
      try { parsed = JSON.parse(body); } catch { res.writeHead(400).end(); return; }
      const events = sanitizeAll(parsed, now());
      if (events.length) onEvents(events);
      res.writeHead(204).end();
    });
  };
}
