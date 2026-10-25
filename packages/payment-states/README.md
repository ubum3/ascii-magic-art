# ascii-magic-art-payment-states

Payment, payout, onboarding and POS terminal statuses as ascii-magic-art pieces. One table, [`src/states.json`](src/states.json), maps each status to a library piece or an extras spec, a tone and a label, plus aliases for PSP event codes. The React, Go and Rust entry points all read that same table.

| Status | Art | Tone |
|---|---|---|
| `pending` | `hourglass` | wait |
| `authorised` | `empty-payment-success` | ok |
| `declined` | `empty-payment-failed` | fail |
| `voided` | `empty-trash-lid` | warn |
| `refund` | `spinning-coin` + "refunded" caption | warn |
| `chargeback` | glitch text spec | fail |
| `payout-scheduled` | `digital-clock` | wait |
| `payout-sent` | `empty-inbox-plane` | ok |
| `settled` | fireworks celebrate spec | ok |
| `onboarding` | `empty-onboarding-flag` | wait |
| `kyc-review` | `hourglass` + "reviewing documents" caption | wait |
| `kyc-rejected` | `empty-access-denied` | fail |
| `merchant-live` | `empty-rocket-countdown` | ok |
| `terminal-offline` | `empty-offline-plug` | fail |
| `terminal-reconnecting` | `empty-reconnecting` | wait |
| `rate-limited` | `empty-rate-limited` | warn |
| `session-expired` | `empty-session-expired` | warn |
| `demo` | `checkout-payment-flow` | ok |

## Aliases and event codes

`normalise(code, { success })` takes a status, an alias or a PSP event code. Case, spaces and underscores don't matter (`payment_intent.succeeded`, `NOTIFICATION_OF_CHARGEBACK`, `terminal offline`). An unknown `prefix.word` falls back to `word`. Event codes that have two outcomes, such as Adyen's `AUTHORISATION`, `CAPTURE`, `REFUND` and `CANCELLATION`, pick the outcome from the `success` flag:

```js
import { normalise, resolveState } from "ascii-magic-art-payment-states";
normalise("AUTHORISATION", { success: false });  // "declined"
resolveState("payout.paid");  // { status: "payout-sent", tone: "ok", label: "Payout sent", slug: "empty-inbox-plane" }
```

`resolveState` throws on an unknown status unless you pass `{ fallback: "pending" }`.

## React

```jsx
import { PaymentState } from "ascii-magic-art-payment-states/react";

<PaymentState status={event.eventCode} success={event.success} description="We'll email the receipt." action={<a href="/orders">Orders</a>} />
```

The wrapper is a `role="status"` polite live region, with `data-status` and `data-tone` for styling. The title defaults to the label. `title={null}` hides the title, but the label stays in the region for screen readers, so the status is never shown by animation alone. Look and playback props (`look`, `mono`, `still`, `speed`, ...) pass through to the art, as in `ascii-magic-art-react`.

## Go (Bubble Tea)

```go
import paymentstate "github.com/ubum3/ascii-magic-art/packages/payment-states/go"

s, err := paymentstate.New(paymentstate.NormaliseEvent("AUTHORISATION", false), asciiart.Look{})
// s.Art (and s.Caption, if any) are *asciiart.JSPiece; s.Label, s.Tone
```

## Rust (ratatui)

```rust
use ascii_magic_art_payment_states::{normalise_event, payment_state};
let s = payment_state(normalise_event("AUTHORISATION", false).unwrap())?;
// s.art (and s.caption) are JsPiece; s.label, s.state.tone
```

## Editing the table

Edit `src/states.json`, then run `npm run sync` to copy it into `go/` and `rust/` (both embed it). `npm test` fails while the copies are stale. The tests check that every slug exists, every spec and caption renders through extras `make()`, the aliases don't collide, and the React output server-renders. The Go and Rust tests load and draw every status.
