import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fromSpec } from "ascii-magic-art-extras";
import {
  wallLayout, initial, reduce, tick, view, money, mockEvents, sanitize, sanitizeAll, sseParser, burstId, MAX_BURSTS, BURST_SECONDS, SCHEME_IDS,
} from "../src/index.js";
import { sign, verify, SIGNATURE_HEADER } from "../src/sources/webhook.js";
import { createWall, createServer } from "../src/server.js";

const GOLDEN = path.join(path.dirname(fileURLToPath(import.meta.url)), "golden");
/** Compare with a stored golden; UPDATE=1 rewrites it. */
function golden(name, value) {
  const file = path.join(GOLDEN, name), text = typeof value === "string" ? value : JSON.stringify(value, null, 1) + "\n";
  if (process.env.UPDATE || !fs.existsSync(file)) { fs.mkdirSync(GOLDEN, { recursive: true }); fs.writeFileSync(file, text); }
  assert.equal(text, fs.readFileSync(file, "utf8"), `${name} (UPDATE=1 to accept)`);
}

const T0 = 1_700_000_000_000;
const run = (events, s = initial(T0)) => events.reduce(reduce, s);
const auth = (scheme, ts, amount = 1000) => ({ type: "auth", scheme, amount, currency: "USD", ts });

test("mock: the same seed gives the same events, Poisson-ish at the rate", () => {
  const a = [...mockEvents({ seed: 7, start: T0, until: T0 + 60_000, rate: 4 })];
  const b = [...mockEvents({ seed: 7, start: T0, until: T0 + 60_000, rate: 4 })];
  const c = [...mockEvents({ seed: 8, start: T0, until: T0 + 60_000, rate: 4 })];
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.ok(a.every((e, i) => i === 0 || e.ts >= a[i - 1].ts), "in time order");
  assert.ok(a.every((e) => e.ts >= T0 && e.ts < T0 + 60_000));
  const n = a.filter((e) => e.type === "auth" || e.type === "decline").length;
  assert.ok(n > 180 && n < 300, `${n} arrivals in a minute at 4/s`);
  assert.ok(a.some((e) => e.type === "payout") && a.some((e) => e.type === "decline"));
  assert.ok(a.every((e) => e.type === "payout" || SCHEME_IDS.includes(e.scheme)));
});

test("mockSource: plays on timers, and drops what a sleep made stale", async () => {
  const { mockSource } = await import("../src/sources/mock.js");
  let clock = T0;
  const timers = [], got = [];
  const stop = mockSource({ seed: 2, rate: 5 }, (e) => got.push(e), { now: () => clock, setTimer: (fn, ms) => timers.push([fn, ms]), clearTimer: () => {} });
  const fire = () => { const [fn, ms] = timers.shift(); clock += ms; fn(); };
  for (let i = 0; i < 20; i++) fire();
  assert.equal(got.length, 20);
  clock += 6 * 3600_000; // six hours asleep
  fire();
  const before = got.length;
  fire();
  assert.ok(got.length - before <= 1, "no flood of six hours of events");
  assert.ok(got.at(-1).ts >= clock - 5000);
  stop();
});

test("reduce: a seeded minute, as a golden view", () => {
  const events = [...mockEvents({ seed: 7, start: T0, until: T0 + 60_000, rate: 4 })];
  golden("view-seed7.json", view(tick(run(events), T0 + 60_000)));
});

test("reduce: one burst per scheme, at most MAX_BURSTS, the rest coalesced", () => {
  let s = run([auth("visa", T0), auth("visa", T0 + 50, 500)]);
  assert.equal(s.play[burstId("visa")], 1, "the second visa joins the first");
  assert.equal(view(s).regions[burstId("visa")].message, "VISA\u00a0×2\u00a0$15.00");
  s = run([auth("mastercard", T0 + 60), auth("amex", T0 + 70), auth("discover", T0 + 80)], s);
  assert.equal(Object.keys(s.bursts).length, MAX_BURSTS);
  assert.equal(s.play[burstId("discover")], undefined, "over the cap");
  assert.equal(s.coalesced, 2);
  // once the bursts end, the next auth fires again
  s = run([auth("visa", T0 + BURST_SECONDS * 1000 + 100)], s);
  assert.equal(s.play[burstId("visa")], 2);
  assert.equal(Object.keys(s.bursts).length, 1);
});

test("reduce: above BUSY_RATE a second, auths join the burst on screen", () => {
  const busy = Array.from({ length: 12 }, (_, i) => auth(SCHEME_IDS[i % 4], T0 + i * 40));
  const s = run(busy);
  const plays = Object.values(s.play).reduce((a, b) => a + b, 0);
  assert.ok(plays <= MAX_BURSTS, `${plays} bursts for 12 auths in half a second`);
  assert.equal(s.count, 12);
});

test("reduce: buckets roll with the clock, approval and payouts", () => {
  let s = run([auth("visa", T0), { type: "decline", scheme: "visa", ts: T0 + 10 }, { type: "payout", amount: 1234500, currency: "USD", ts: T0 + 20 }]);
  let v = view(s);
  assert.equal(v.regions.spark.values.at(-1), 1);
  assert.equal(v.regions.approval.label, "Approval 50.0%");
  assert.equal(v.regions.payout.message, "PAYOUT\u00a0$12,345.00");
  assert.equal(v.play.payout, 1);
  s = tick(s, T0 + 5000);
  v = view(s);
  assert.equal(v.regions.spark.values.at(-1), 0);
  assert.equal(v.regions.spark.values.at(-6), 1, "five seconds back");
  assert.equal(v.regions.payout, undefined, "the payout has played");
  assert.deepEqual(tick(s, T0 + 5000), s, "tick is idempotent");
  assert.equal(money(123456789, "USD"), "$1,234,567.89");
  assert.equal(money(5000, "JPY"), "¥5,000");
  assert.equal(money(99, "CHF"), "CHF 0.99");
});

test("sanitize: only the allowed fields, from enums and numbers", () => {
  const dirty = {
    type: "auth", scheme: "VISA", amount: "4210", currency: "usd", ts: T0,
    pan: "4111111111111111", card: { number: "4111111111111111" }, name: "Ada Lovelace", email: "ada@example.com", merchant: "<script>",
  };
  assert.deepEqual(sanitize(dirty, T0), { type: "auth", scheme: "visa", amount: 4210, currency: "USD", ts: T0 });
  assert.equal(JSON.stringify(sanitizeAll({ events: [dirty, dirty] }, T0)).includes("4111"), false);
  assert.equal(sanitize({ type: "steal" }, T0), null);
  assert.equal(sanitize({ type: "auth", scheme: "constructor", ts: T0 }, T0).scheme, undefined);
  assert.equal(sanitize({ type: "auth", scheme: "__proto__", ts: T0 }, T0).scheme, undefined);
  assert.equal(sanitize({ type: "auth", amount: -5, currency: "dollars", ts: T0 }, T0).amount, undefined);
  assert.equal(sanitize({ type: "auth", ts: T0 + 3_600_000 }, T0).ts, T0, "a clock an hour off is replaced");
  assert.equal(sanitizeAll(Array.from({ length: 5000 }, () => ({ type: "refund" })), T0).length, 1000);
});

test("webhook: HMAC over timestamp and body, replay window", () => {
  const body = JSON.stringify({ type: "auth", scheme: "visa", amount: 100 });
  const now = T0, t = Math.floor(now / 1000), h = sign("s3cret", body, t);
  assert.ok(verify("s3cret", body, h, { now }));
  assert.ok(!verify("other", body, h, { now }), "wrong secret");
  assert.ok(!verify("s3cret", body + " ", h, { now }), "changed body");
  assert.ok(!verify("s3cret", body, h, { now: now + 301_000 }), "too old");
  assert.ok(!verify("s3cret", body, "t=1,v1=zz", { now }));
  assert.ok(!verify("s3cret", body, undefined, { now }));
  assert.ok(!verify("", body, h, { now }), "no secret, no webhook");
});

test("sseParser: messages across chunks, comments, multi-line data, CRLF", () => {
  const got = [];
  const feed = sseParser((d) => got.push(d));
  feed(": hi\n\nda");
  feed("ta: {\"a\":1}\n\n");
  feed("data: one\r\ndata: two\r\n\r\nevent: x\ndata:three\n");
  feed("\n");
  assert.deepEqual(got, ['{"a":1}', "one\ntwo", "three"]);
});

test("the composed wall: right size, merged palette, a burst over the chart", () => {
  const spec = wallLayout({ cols: 72, rows: 20, drift: 0 });
  const piece = fromSpec(spec);
  assert.equal(piece.meta.cols, 72);
  assert.equal(piece.meta.rows, 20);
  const events = [...mockEvents({ seed: 3, start: T0, until: T0 + 20_000, rate: 2 }), auth("visa", T0 + 20_000, 4210)];
  const state = view(tick(run(events), T0 + 20_000));
  const draw = piece.default();
  let f;
  for (const t of [0, 0.5, 1, 1.5]) f = draw(t, state);
  const rows = f.text.split("\n");
  assert.equal(rows.length, 20);
  assert.ok(rows.every((r) => [...r].length === 72));
  for (const k of new Set(f.color.replace(/[\n ]/g, ""))) assert.ok(piece.meta.palette[k], `key ${k}`);
  assert.match(f.text, /LIVE PAYMENTS/);
  assert.match(f.text, /Auths \/ s/);
  assert.match(f.text, /96\.8%/, "the approval bar");
  const visa = new Set(spec.regions.find((r) => r.id === burstId("visa")).spec.hues);
  assert.ok([...f.color].some((k) => visa.has(piece.meta.palette[k])), "visa's colours on screen");
  golden("frame-72x20.txt", f.text + "\n");
});

test("server: layout, state stream, signed webhook", async () => {
  const wall = createWall();
  const server = createServer({ wall, secret: "s3cret", app: "/* app */" });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const layout = await (await fetch(`${base}/layout.json?cols=60&rows=18`)).json();
    assert.equal(layout.kind, "layout");
    assert.equal(layout.cols, 60);
    assert.equal((await fetch(`${base}/app.js`)).headers.get("content-type"), "text/javascript; charset=utf-8");

    const body = JSON.stringify([{ type: "auth", scheme: "amex", amount: 2500, currency: "USD", pan: "378282246310005" }]);
    const post = (headers, b = body) => fetch(`${base}/webhook`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: b });
    assert.equal((await post({})).status, 401);
    assert.equal((await post({ [SIGNATURE_HEADER]: sign("nope", body) })).status, 401);
    const events = [];
    const off = wall.subscribeEvents((e) => events.push(e));
    assert.equal((await post({ [SIGNATURE_HEADER]: sign("s3cret", body) })).status, 204);
    off();
    assert.equal(events.length, 1);
    assert.ok(!events[0].includes("3782"), "no PAN on /events");
    assert.equal(wall.state().play[burstId("amex")], 1);
    const big = "x".repeat(70 * 1024);
    assert.equal((await post({ [SIGNATURE_HEADER]: sign("s3cret", big) }, big).catch(() => ({ status: 413 }))).status, 413);
    assert.equal((await fetch(`${base}/webhook`)).status, 405);

    const ctrl = new AbortController();
    const res = await fetch(`${base}/state`, { signal: ctrl.signal });
    assert.equal(res.headers.get("content-type"), "text/event-stream");
    const reader = res.body.getReader(), dec = new TextDecoder();
    let text = "";
    while (!/\ndata: .*\n\n/.test(text)) text += dec.decode((await reader.read()).value);
    ctrl.abort();
    const first = JSON.parse(text.match(/\ndata: (.*)\n\n/)[1]);
    assert.equal(first.play[burstId("amex")], 1);
  } finally {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
