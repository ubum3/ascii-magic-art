---
name: ama-cli-kit
description: ascii-magic-art-cli-kit (packages/cli-kit), an animated CLI intro that stays in the scrollback, plus a progress bar and spinner that degrade to plain text. Use when asked to "add an intro/banner to a CLI", "progress bar", "spinner", "mode()", "NO_COLOR/CI behaviour", or to change packages/cli-kit.
---

# ama-cli-kit

## What it is

Three terminal helpers drawn by pieces and extras specs: `intro()` moves once in place and then rests in the scrollback, and `progress()` and `spinner()` redraw on stderr at about 15 fps and leave one ✓/✗ line. Each one picks its own output mode (`anim`, `static`, `plain`) from the stream and the environment, so piped output and CI logs get plain text with no escape codes.

- Path: `packages/cli-kit` (`src/index.js`, `src/intro.js`, `src/live.js`, `src/mode.js`, `src/source.js`, `src/index.d.ts`)
- Package: `ascii-magic-art-cli-kit` (Node >= 20; depends on `ascii-magic-art-extras` and `ascii-magic-art-studio`)

## Quick start

```js
import { intro, progress, spinner } from "ascii-magic-art-cli-kit";

await intro("my-cli", { tagline: "v1.0.0" });
const bar = progress({ label: "Uploading" });
bar.update(0.4); bar.done("Uploaded");
const s = spinner("Installing");
s.text("Linking"); s.succeed("Installed");
```
Try it: `node packages/cli-kit/examples/demo.mjs [slug|words]`, then piped to `cat`, then with `CI=1`.

## Core API

| function | signature | notes |
|---|---|---|
| `intro` | `intro(src, { seconds, tagline = "", out = process.stdout, state, env = process.env })` → `Promise<{ cols, rows, mode, interrupted }>` | `src`: a string (a library slug if `pieces/<s>.js` exists, else words in the extras `text` kind with `scramble`), `{ text, ... }` (forces words), `{ slug }` (forces a piece), an extras spec `{ kind, ... }`, or a piece module `{ meta, default }` |
| `progress` | `progress({ label = "", cols, out = process.stderr, env })` → `{ update(value, label?), done(message?) }` | extras `progress` kind, 2 rows; width `max(10, min(cols or 40, out.columns - 1))` |
| `spinner` | `spinner(label = "", { out = process.stderr, env })` → `{ text(label), succeed(message?), fail(message?) }` | a 10-col extras `ticker` strip, then the label cut to fit one row |
| `mode` | `mode(stream = process.stdout, env = process.env)` → `"anim" \| "static" \| "plain"` | |
| `isCI` | `isCI(env)` → boolean | `CI GITHUB_ACTIONS BUILDKITE GITLAB_CI CIRCLECI TF_BUILD JENKINS_URL`; `""`, `"0"`, `"false"` count as unset |
| `colorOn` | `colorOn(env)` → `!env.NO_COLOR` | |

`mode` rules (`src/mode.js`): `plain` when `stream.isTTY !== true`, under CI, `TERM=dumb`, or `AMA_NO_INTRO` set; `static` when `AMA_NO_MOTION` is set; otherwise `anim`. `NO_COLOR` keeps the motion and drops colour.

Behaviour by mode:
- `intro` plain: writes its words and the tagline, no escape codes. Static: one frame at `t = seconds`. Too narrow: words only. Too short (`out.rows <= rows + 1`): still frame. A `resize` event stops it where it is. Ctrl+C sets `interrupted: true` and ends the motion, not the program.
- `progress` plain: a line at 25%, 50% and 75%, then `✓ <message>` on `done`. `spinner` plain: `label…` once, then `✓`/`✗` and the message.

## Common tasks

**Intro from a slug, words, or a spec**
```js
await intro("spinning-torus");                                  // a library piece
await intro({ text: "spinning-torus" });                        // force words
await intro({ kind: "text", text: "ACME", effect: "wave" }, { tagline: "v2.1" });
await intro({ kind: "celebrate", message: "Deployed", style: "confetti" }, { seconds: 2 });
```

**Still intro (no motion)**: `await intro("ACME", { seconds: 0 })`, or set `AMA_NO_MOTION=1`.

**Progress with changing labels**
```js
const bar = progress({ label: "Uploading", cols: 30 });
files.forEach((f, i) => bar.update((i + 1) / files.length, `Uploading ${f}`));
bar.done("Uploaded");
```

**Test output without a TTY**: pass a fake stream and env, as `test/cli-kit.test.mjs` does with its `Fake` class (an `EventEmitter` with `isTTY`, `columns`, `rows`, `write`):
```js
const out = new Fake({ tty: false });
await intro("HI", { out, env: { TERM: "xterm-256color" } });   // out.text === "HI\n"
```

**Force a mode in a shell**: `CI=1 node app.js`, `AMA_NO_INTRO=1`, `AMA_NO_MOTION=1`, `NO_COLOR=1`, `TERM=dumb`.

## Testing and verification

```bash
npm test -w packages/cli-kit              # 10 tests: mode matrix, intro modes, Ctrl+C, resize, progress/spinner
node packages/cli-kit/examples/demo.mjs | cat
CI=1 node packages/cli-kit/examples/demo.mjs
node scripts/validate.mjs                 # repo root: 634/634 pieces pass
```

## Rules and gotchas

- Additive only: no edits to `pieces/`, `lib/`, `runtime/`, `bin/`, or the `ascii/` and `shaders/` forks.
- Existing goldens (`packages/fixtures/*.bin`) must stay byte-identical.
- `intro` defaults to stdout but `progress`/`spinner` default to stderr, so `node app.js > log` still animates the bar on a terminal stderr. Pass `out` to change that.
- Don't `console.log` to the same terminal while a bar or spinner runs; it redraws over its last lines. Use `.update()` / `.text()`.
- Always end a bar or spinner (`done`, `succeed`, `fail`): that erases it and shows the cursor. Their timers are unref'd, so they never keep the process alive, and an `exit` handler restores the cursor.
- `intro` throws when `seconds` is negative or not finite, and rejects an object with no `kind`, `text`, `slug` or `meta`.
- A string is treated as a slug only if it matches `^[a-z0-9-]+$` and `pieces/<s>.js` exists; otherwise it is words.
- Rendering width is the terminal width minus one column, on purpose (a full-width row breaks `\x1b[K`).
- Colour goes through `ascii-magic-art-studio/src/ansi.js`, so it matches `ama-studio play`.
