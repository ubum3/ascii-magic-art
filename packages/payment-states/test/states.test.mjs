import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { make } from "ascii-magic-art-extras";
import { STATUSES, TABLE, normalise, resolveState } from "../src/index.js";
import { PaymentState } from "../src/react.js";

const PIECES = path.join(path.dirname(createRequire(import.meta.url).resolve("ascii-magic-art/package.json")), "pieces");

test("18 statuses, each with a tone, a label and art", () => {
  assert.equal(STATUSES.length, 18);
  for (const s of STATUSES) {
    const r = resolveState(s);
    assert.ok(TABLE.tones.includes(r.tone), s);
    assert.ok(r.label.length > 3, s);
    assert.ok(!!r.slug !== !!r.spec, `${s}: a slug or a spec, not both`);
  }
});

test("every slug is a library piece", () => {
  for (const s of STATUSES) {
    const { slug } = resolveState(s);
    if (slug) assert.ok(fs.existsSync(path.join(PIECES, slug + ".js")), `${s}: no piece ${slug}`);
  }
});

test("every spec and caption renders through extras make()", () => {
  for (const s of STATUSES) {
    const r = resolveState(s);
    for (const spec of [r.spec, r.caption].filter(Boolean)) {
      const { meta, create } = make(spec);
      const f = create()(1.5);
      const rows = (typeof f === "string" ? f : f.text).split("\n");
      assert.equal(rows.length, meta.rows, s);
      for (const row of rows) assert.equal([...row].length, meta.cols, s);
    }
  }
});

test("aliases: no duplicates, none shadows a status, all resolve to a status", () => {
  const seen = new Map();
  for (const [status, names] of Object.entries(TABLE.aliases)) {
    assert.ok(STATUSES.includes(status), status);
    for (const n of names) {
      assert.ok(!seen.has(n), `${n} is an alias of ${seen.get(n)} and ${status}`);
      assert.ok(!STATUSES.includes(n), `${n} shadows a status`);
      assert.equal(n, n.toLowerCase().replace(/[\s_]+/g, "-"), `${n} is not normalised`);
      seen.set(n, status);
    }
  }
  for (const [code, pair] of Object.entries(TABLE.outcomes)) for (const s of pair) assert.ok(STATUSES.includes(s), `${code}: ${s}`);
});

test("normalise: PSP codes, success flags, case and separators", () => {
  const cases = {
    Authorised: "authorised", AUTHORIZED: "authorised", "payment_intent.succeeded": "authorised", REFUSED: "declined",
    CANCELLATION: "voided", NOTIFICATION_OF_CHARGEBACK: "chargeback", "charge.dispute.created": "chargeback",
    "payout.paid": "payout-sent", "payout.created": "payout-scheduled", "foo.succeeded": "authorised",
    "terminal offline": "terminal-offline", 429: "rate-limited", "awaiting_data": "kyc-review",
  };
  for (const [code, want] of Object.entries(cases)) assert.equal(normalise(code), want, code);
  assert.equal(normalise("AUTHORISATION", { success: false }), "declined");
  assert.equal(normalise("AUTHORISATION", { success: "true" }), "authorised");
  assert.equal(normalise("REFUND", { success: false }), "declined");
  assert.equal(normalise("REFUND"), "refund");
  for (const bad of ["nope", "", null, undefined, "x.nope"]) assert.equal(normalise(bad), null, String(bad));
});

test("resolveState: unknown throws with the list, or falls back", () => {
  assert.throws(() => resolveState("nope"), /unknown payment status "nope": one of pending, authorised/);
  assert.equal(resolveState("nope", { fallback: "pending" }).status, "pending");
});

test("states.json copies for Go and Rust are in sync", () => {
  const src = fs.readFileSync(new URL("../src/states.json", import.meta.url));
  for (const rel of ["../go/states.json", "../rust/states.json"]) assert.ok(fs.readFileSync(new URL(rel, import.meta.url)).equals(src), rel);
});

test("<PaymentState> server-renders a live region with the label", () => {
  const html = renderToString(h(PaymentState, { status: "AUTHORISATION", success: false, description: "Try another card" }));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /data-status="declined"/);
  assert.match(html, /data-tone="fail"/);
  assert.match(html, /<h2[^>]*>Payment declined<\/h2>/);
  assert.match(html, /Try another card/);
});

test("<PaymentState> spec statuses put their first frame in the HTML; title null keeps the label for screen readers", () => {
  const html = renderToString(h(PaymentState, { status: "chargeback", title: null }));
  assert.match(html, /<pre/);
  assert.doesNotMatch(html, /<h2/);
  assert.match(html, /Chargeback received<\/span>/);
  const refund = renderToString(h(PaymentState, { status: "refunded" }));
  assert.equal((refund.match(/<pre/g) || []).length >= 1, true);
  assert.match(refund, /Refunded/);
});
