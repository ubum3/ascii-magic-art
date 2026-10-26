# ascii-magic-art-wall

A live payments wall for office TVs. Every auth is a firework in its card scheme's colours, payouts rain coins, and there's an auth-rate sparkline, an approval bar and a ticker. The whole screen is one extras `layout` spec with one state, so the browser (React) and the terminal (the ratatui and Bubble Tea packages) draw the same frames.

```sh
npx ama-wall                                   # made-up payments on http://127.0.0.1:8787
npx ama-wall --sse https://feed.internal/pay   # events from an upstream SSE feed
WALL_SECRET=… npx ama-wall --host 0.0.0.0      # signed events on POST /webhook
```

Open the URL on the TV. To show it in a terminal instead:

```sh
cargo run --release --example wall http://127.0.0.1:8787   # packages/ratatui
go run ./examples/wall http://127.0.0.1:8787               # packages/bubbletea
```

## Events

```json
{ "type": "auth" | "decline" | "payout" | "refund", "scheme": "visa", "amount": 4210, "currency": "USD", "ts": 1700000000000 }
```

`amount` is in minor units. Every event from outside goes through `sanitize()`, which rebuilds it from those fields, enums and numbers only. A PAN, name or email in the payload never reaches a screen or `/events`.

Webhooks are signed like most payment webhooks: `X-Wall-Signature: t=<unix>,v1=<hex HMAC-SHA256 of "<t>.<body>">`. A signature older than 5 minutes is refused. `sign()` in `ascii-magic-art-wall/webhook` makes the header.

## Endpoints

| | |
|---|---|
| `GET /` | the React page |
| `GET /layout.json?cols=&rows=` | the layout spec, sized to the screen |
| `GET /state` | SSE: the layout state |
| `GET /events` | SSE: clean events |
| `POST /webhook` | signed events (only with a secret) |

## As a library

```js
import { wallLayout, initial, reduce, tick, view, mockEvents } from "ascii-magic-art-wall";
import { fromSpec } from "ascii-magic-art-extras";

const draw = fromSpec(wallLayout({ cols: 96, rows: 28 })).default();
let s = initial();
for (const e of mockEvents({ seed: 1, until: 10_000 })) s = reduce(s, e);
draw(t, view(tick(s, 10_000)));
```

`reduce` is pure, with the events' `ts` as its clock. It allows one burst per scheme and at most 3 at once. Above 5 auths a second, new auths join the burst already on screen; its message counts them. The layout drifts by a cell over a few minutes so a TV left on doesn't burn in.
