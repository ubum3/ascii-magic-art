# ascii-magic-art-cli-kit

An intro for your CLI that moves once and then stays in the scrollback, plus a progress bar and a spinner. All three are drawn by pieces and [extras](../extras/README.md) specs, and each one degrades by itself.

```js
import { intro, progress, spinner } from "ascii-magic-art-cli-kit";

await intro("my-cli", { tagline: "v1.0.0" });          // words, a slug, a spec or a piece module
const bar = progress({ label: "Uploading" });
bar.update(0.4); /* ... */ bar.done("Uploaded");
const s = spinner("Installing");
s.text("Linking"); /* ... */ s.succeed("Installed");
```

| where | intro | progress / spinner |
|---|---|---|
| a terminal | moves in place, then rests | redraw on stderr at ~15 fps, erase themselves, leave one ✓/✗ line |
| piped, `CI`, `GITHUB_ACTIONS`, `BUILDKITE`, `TERM=dumb`, `AMA_NO_INTRO` | its words and tagline, no escape codes | a line at each 25%, one at the end |
| `AMA_NO_MOTION` | one still frame in colour | as a terminal |
| `NO_COLOR` | moves, without colour | without colour |
| too narrow / too short | its words / one still frame | the label is cut to fit |

- **`intro(src, { seconds, tagline, out, state })`** resolves to `{ cols, rows, mode, interrupted }`. A string is a library slug when one has that name, otherwise words in the extras `text` kind; pass `{ text }` or `{ slug }` to say which. Ctrl+C ends the motion, not your program, and the cursor always comes back. A resize stops it where it is.
- **`progress({ label, cols, out })`** and **`spinner(label, { out })`** write to stderr by default. Their timers are unref'd, so they never keep a program alive. Don't log to the same terminal while one runs: change what it says with `.update()` or `.text()`.
- **`mode(stream)`** gives `"anim"`, `"static"` or `"plain"`, by the rules above.

The scrollback model is ported from [ascii.rest](https://github.com/bas3line/ascii)'s `print.ts` (MIT). Terminal colour comes from `ascii-magic-art-studio`'s `ansi.js`, so it matches `ama-studio play`.

Try it: `node examples/demo.mjs [slug|words]`, then the same piped to `cat` and with `CI=1`.
