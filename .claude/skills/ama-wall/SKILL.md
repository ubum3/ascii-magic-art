---
name: ama-wall
description: ascii-magic-art-wall (packages/wall) - a live payments wall for office TVs (scheme-coloured auth fireworks, payout coins, sparkline, ticker) fed by mock, SSE or HMAC-signed webhooks into one extras layout. Use for "payments wall", "transaction dashboard on a TV", "webhook to the wall", "wall in the terminal", or layout specs.
---

# ama-wall: the live transaction wall

## What it is

Payment events (`auth`, `decline`, `payout`, `refund`) go through a field allowlist, a pure reducer turns them into one state, and that state drives a single extras `layout` spec. React in the browser and the ratatui / Bubble Tea examples in a terminal play the same frames.

- Path: `packages/wall/` (`src/index.js`, `src/reduce.js`, `src/screen.js`, `src/schemes.js`, `src/server.js`, `src/bundle.js`, `src/sources/{event,mock,sse,webhook}.js`, `web/app.jsx`, `bin/ama-wall.js`)
- Package: `ascii-magic-art-wall` (exports `.`, `./server`, `./webhook`), bin `ama-wall`
- Layout kind: `packages/extras/src/layout.js` (`kind: "layout"`)

## Quick start

```sh
npx ama-wall                    # seeded mock payments on http://127.0.0.1:8787
```
Open the URL on the TV, or in a terminal:
```sh
cd packages/ratatui && cargo run --release --example wall http://127.0.0.1:8787
cd packages/bubbletea && go run ./examples/wall http://127.0.0.1:8787
```

## Core API / commands

CLI (`ama-wall`): `--port` (8787), `--host` (127.0.0.1; 0.0.0.0 for LAN), `--mock` / `--no-mock` (on unless `--sse` or a secret), `--seed` (1), `--rate` (3 auths/s), `--sse <url>` (repeatable), `--secret <s>` or env `WALL_SECRET` (enables POST /webhook), `--layout <file>`, `--title` (LIVE PAYMENTS).

Endpoints: `GET /` page, `GET /layout.json?cols=&rows=`, `GET /state` (SSE layout state, ~10/s while it changes), `GET /events` (SSE clean events), `POST /webhook` (only with a secret, else 404), `GET /healthz`.

| Export | Signature |
|---|---|
| `wallLayout` | `({ cols = 96, rows = 28, title, drift = 1 }) => layout spec` (min 40x14) |
| `initial` / `reduce` / `tick` / `view` | `initial(now?)`, `reduce(s, e)`, `tick(s, nowMs)`, `view(s) => { regions, play }` |
| `money` | `(minor, currency = "USD") => "$42.10"` |
| `MAX_BURSTS` 3, `BUSY_RATE` 5, `BUCKETS` 120, `BURST_SECONDS` 2.4, `PAYOUT_SECONDS` 3.2 | constants |
| `SCHEMES`, `SCHEME_IDS`, `burstId(scheme)` | visa, mastercard, amex, discover; `burst-<scheme>` |
| `sanitize(e, now?)`, `sanitizeAll(body, now?)`, `TYPES` | the allowlist |
| `mockEvents(opts)` generator, `mockSource(opts, onEvent)` => stop, `rng(seed)` | seeded demo data |
| `sseParser(onMessage)`, `sseSource(url, onEvent, { headers, onError })` => stop | upstream feed, reconnects with backoff |
| `./server`: `createWall({ now })`, `createServer({ wall, layout, title, secret, app, tolerance })` | |
| `./webhook`: `sign(secret, body, t?)`, `verify(secret, body, header, { tolerance = 300, now })`, `webhookHandler({ secret, onEvents, tolerance })`, `SIGNATURE_HEADER` | |

Event shape: `{ type, scheme, amount (minor units), currency (3 letters), ts (ms) }`.

## Common tasks

Library use, headless:
```js
import { wallLayout, initial, reduce, tick, view, mockEvents } from "ascii-magic-art-wall";
import { fromSpec } from "ascii-magic-art-extras";
const draw = fromSpec(wallLayout({ cols: 96, rows: 28 })).default();
let s = initial();
for (const e of mockEvents({ seed: 1, until: 10_000 })) s = reduce(s, e);
draw(10, view(tick(s, 10_000)));
```

Signed webhook server and a sender:
```sh
WALL_SECRET=… npx ama-wall --no-mock --host 0.0.0.0
```
```js
import { sign } from "ascii-magic-art-wall/webhook";
const body = JSON.stringify({ type: "auth", scheme: "visa", amount: 4210, currency: "USD", ts: Date.now() });
await fetch("http://wall:8787/webhook", { method: "POST", body, headers: { "x-wall-signature": sign(secret, body) } });
```

Upstream SSE feed with auth: `sseSource(url, (e) => wall.push(e), { headers: { authorization: "Bearer …" } })`, or `npx ama-wall --sse https://feed.internal/pay`.

Custom screen: write a `{ kind: "layout", cols, rows, drift, regions: [{ id, x, y, w, h, play?, opaque?, spec }] }` file and pass `--layout file.json`. State is `{ regions: { id: state }, play: { id: n } }`; bump `play[id]` to fire a `play` region again.

Rebuild the browser bundle (build `ascii-magic-art-react` first): `cd packages/wall && npm run build` (writes `dist/app.js`; otherwise bundled in memory).

## Testing and verification

```sh
cd packages/wall && npm test            # node --test (11 tests)
cd packages/wall && UPDATE=1 npm test   # accept new test/golden/* after an intended change
node scripts/validate.mjs                # repo root: 634/634 pieces pass
```

Tests: seeded mock determinism; `mockSource` drops stale events; a seeded minute as golden `view-seed7.json`; one burst per scheme, `MAX_BURSTS`, `BUSY_RATE` coalescing; bucket roll and approval; `sanitize` allowlist; HMAC and replay window; `sseParser` chunking/CRLF; the composed frame golden `frame-72x20.txt`; and the server (layout, state stream, signed webhook).

## Rules and gotchas

- Repo rules: additive only; never edit `pieces/`, `lib/`, `runtime/` or `bin/`. Validate stays 634/634.
- Field allowlist: every outside event goes through `sanitize()`, which rebuilds it from `type` (enum), `scheme` (known enum), `amount` (0..1e12, rounded), `currency` (`/^[A-Za-z]{3}$/`) and `ts` (replaced by server time if missing or >5 min off). Never add a free-text field, and never push unsanitized events into `wall.push` from a new source. PANs, names and emails must not reach a screen, `/events`, or logs.
- Don't log event bodies or webhook payloads. Log errors by message only.
- HMAC: `X-Wall-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">`, compared with `timingSafeEqual`; older than `tolerance` (300 s) is refused. Sign the exact raw body. Bodies over 64 KB get 413, bad signature 401, bad JSON 400, non-POST 405; at most 1000 events a body.
- `webhookHandler` throws without a secret; keep the default host 127.0.0.1 unless the webhook is secret-protected.
- `reduce` is pure and uses the events' `ts` as its clock; no `Date.now()` inside. `view` only reports bursts playing now so late screens don't replay old ones.
- Overlay messages use no-break spaces: a plain space in a layout region is transparent.
- `drift` moves the layout a cell over minutes against burn-in; leave it on for TVs.
- Scheme colours in `schemes.js` are not brand assets.
