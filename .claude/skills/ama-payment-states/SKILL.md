---
name: ama-payment-states
description: ascii-magic-art-payment-states (packages/payment-states) - 18 payment, payout, KYC and terminal statuses mapped to ASCII art, with PSP code normalise, for JS, React, Go and Rust. Use for "show a declined payment", "Adyen webhook to animation", "payout sent screen", "terminal offline state", or editing states.json.
---

# ama-payment-states: payment statuses as ASCII art

## What it is

One table, `src/states.json`, maps 18 statuses to a library piece (`slug`) or an extras `spec`, a `tone` (`ok`, `wait`, `warn`, `fail`), a `label`, an optional `caption` spec, plus `aliases` and two-outcome `outcomes` for PSP event codes (Adyen, Stripe-style dotted codes). JS, React, Go (Bubble Tea) and Rust (ratatui) all read that table.

- Path: `packages/payment-states/`
- npm package: `ascii-magic-art-payment-states` (exports `.`, `./react`, `./states.json`)
- Go: `packages/payment-states/go`, module `github.com/ubum3/ascii-magic-art/packages/payment-states/go`, package `paymentstate`
- Rust: `packages/payment-states/rust`, crate `ascii-magic-art-payment-states`

Statuses: `pending`, `authorised`, `declined`, `voided`, `refund`, `chargeback`, `payout-scheduled`, `payout-sent`, `settled`, `onboarding`, `kyc-review`, `kyc-rejected`, `merchant-live`, `terminal-offline`, `terminal-reconnecting`, `rate-limited`, `session-expired`, `demo`.

## Quick start

```js
import { normalise, resolveState } from "ascii-magic-art-payment-states";
normalise("AUTHORISATION", { success: false });  // "declined"
resolveState("payout.paid");
// { status: "payout-sent", tone: "ok", label: "Payout sent", slug: "empty-inbox-plane" }
```

## Core API

JS (`src/index.js`):

| Export | Signature |
|---|---|
| `normalise` / `normalize` | `(code, { success? }) => PaymentStatus \| null` |
| `resolveState` | `(status, { success?, fallback? }) => { status, tone, label, slug?, spec?, caption? }`; throws on unknown unless `fallback` |
| `STATUSES`, `TONES`, `TABLE` | status list in table order, tones, the parsed JSON |

`normalise` lower-cases and turns spaces/underscores into `-`; with `success` set and the code in `TABLE.outcomes` (`authorisation`, `capture`, `refund`, `cancellation`, `cancel-or-refund`, `payout-thirdparty`, `chargeback-reversed`) it returns `[ok, fail][success ? 0 : 1]`; otherwise status, then alias, then the part after the last `.`. `success` accepts `true`/`false`/`"true"`/`"false"`.

React (`./react`): `<PaymentState status success? fallback? title? description? action? size? captionSize? as? speed? still? paused? className? style? ...lookProps />`. Renders a `role="status"` `aria-live="polite"` wrapper with `data-status` and `data-tone`; slug via `AsciiArt`, spec/caption via `AsciiSpec`.

Go: `Statuses() []string`, `Normalise(code) string` (`""` if unknown), `NormaliseEvent(code, success bool) string`, `Resolve(status) (State, error)` (`*UnknownStatusError`), `New(status, asciiart.Look) (*Art, error)` with `Art.Art`, `Art.Caption` (`*asciiart.JSPiece`), embedded `State{Status, Tone, Label, Slug, Spec, Caption}`.

Rust: `statuses()`, `normalise(&str) -> Option<&'static str>`, `normalise_event(&str, bool) -> Option<&'static str>`, `resolve(&str) -> Result<State, Error>`, `payment_state(&str) -> Result<PaymentState, Error>` with `.state`, `.label`, `.art: JsPiece`, `.caption: Option<JsPiece>`. `Error::UnknownStatus(String)` / `Error::Art(..)`.

## Common tasks

Adyen notification item to UI (JS):
```js
const s = resolveState(item.eventCode, { success: item.success, fallback: "pending" });
```

React:
```jsx
import { PaymentState } from "ascii-magic-art-payment-states/react";
<PaymentState status={event.eventCode} success={event.success} description="We'll email the receipt." action={<a href="/orders">Orders</a>} />
```

Hide the heading but keep it for screen readers: `<PaymentState status="declined" title={null} />`.

Go (Bubble Tea):
```go
s, err := paymentstate.New(paymentstate.NormaliseEvent("AUTHORISATION", false), asciiart.Look{})
```

Rust (ratatui):
```rust
use ascii_magic_art_payment_states::{normalise_event, payment_state};
let s = payment_state(normalise_event("AUTHORISATION", false).unwrap())?;
```

Add an alias or change art: edit `src/states.json` only, then:
```sh
cd packages/payment-states && npm run sync && npm test
```

## Testing and verification

```sh
cd packages/payment-states && npm test          # sync --check, then node --test (9 tests)
cd packages/payment-states/go && go test ./...  # loads and draws every status
cd packages/payment-states/rust && cargo test   # same, via QuickJS
node scripts/validate.mjs                        # repo root: 634/634 pieces pass
```

JS tests check: exactly 18 statuses, each a slug XOR a spec; every slug exists in `pieces/`; every spec and caption renders through extras `make()` at exact size; aliases are unique, normalised, and never shadow a status; PSP codes and success flags; React server-renders.

## Rules and gotchas

- Repo rules: additive only; never edit `pieces/`, `lib/`, `runtime/` or `bin/`. Use existing slugs; validate stays 634/634.
- `src/states.json` is the single source. `go/states.json` and `rust/states.json` are copies (go:embed / include_str! can't reach outside their dirs): never hand-edit them; run `npm run sync`. `npm test` fails while they are stale.
- Each state has a `slug` or a `spec`, never both. Aliases must be lower-case with `-` separators.
- `resolveState` and `<PaymentState>` throw on unknown codes: pass `fallback` for live webhook input.
- Go `Normalise` has no success flag; use `NormaliseEvent` for two-outcome codes, or `AUTHORISATION` maps to `authorised` regardless.
- Privacy: pass only the event code and success flag in. Never log or render PSP payloads (card numbers, PANs, names, emails). Verify the PSP's HMAC signature before trusting an event; this package does not.
- Accessibility: the status is always in the live region as text, never animation alone. Keep that.
