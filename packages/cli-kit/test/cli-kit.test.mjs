import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { intro, progress, spinner, mode, isCI } from "../src/index.js";

const ESC = "\x1b", SHOW = "\x1b[?25h", HIDE = "\x1b[?25l";
const TERM = { TERM: "xterm-256color" };

class Fake extends EventEmitter {
  constructor({ tty = true, columns = 120, rows = 40 } = {}) { super(); this.isTTY = tty; this.columns = columns; this.rows = rows; this.chunks = []; }
  write(s) { this.chunks.push(String(s)); return true; }
  get text() { return this.chunks.join(""); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("mode: the matrix", () => {
  assert.equal(mode(new Fake(), TERM), "anim");
  assert.equal(mode(new Fake({ tty: false }), TERM), "plain");
  assert.equal(mode({ write() {} }, TERM), "plain");
  for (const k of ["CI", "GITHUB_ACTIONS", "BUILDKITE"]) assert.equal(mode(new Fake(), { ...TERM, [k]: "true" }), "plain", k);
  assert.equal(mode(new Fake(), { ...TERM, CI: "0" }), "anim", "CI=0 is not CI");
  assert.equal(mode(new Fake(), { TERM: "dumb" }), "plain");
  assert.equal(mode(new Fake(), { ...TERM, AMA_NO_INTRO: "1" }), "plain");
  assert.equal(mode(new Fake(), { ...TERM, AMA_NO_MOTION: "1" }), "static");
  assert.equal(mode(new Fake(), { ...TERM, NO_COLOR: "1" }), "anim", "NO_COLOR keeps the motion");
  assert.equal(isCI({ GITHUB_ACTIONS: "true" }), true);
});

test("intro: plain output is words and the tagline, no escape codes", async () => {
  for (const [out, env] of [[new Fake({ tty: false }), TERM], [new Fake(), { ...TERM, CI: "1" }], [new Fake(), { TERM: "dumb" }]]) {
    const r = await intro("my-cli", { tagline: "v1.0", out, env });
    assert.equal(r.mode, "plain");
    assert.equal(out.text, "my-cli\nv1.0\n");
  }
  const out = new Fake({ tty: false });
  await intro("alien-wave", { out, env: TERM });
  assert.equal(out.text, "Alien Wave\n", "a slug prints its name");
  const spec = new Fake({ tty: false });
  await intro({ kind: "celebrate", message: "Shipped" }, { out: spec, env: TERM });
  assert.equal(spec.text, "Shipped\n");
  assert.ok(![out.text, spec.text].some((s) => s.includes(ESC)));
});

test("intro: moves in place and shows the cursor at the end", async () => {
  const out = new Fake();
  const r = await intro("HI", { seconds: 0.3, tagline: "v1", out, env: TERM });
  assert.equal(r.mode, "anim");
  assert.equal(r.interrupted, false);
  assert.ok(r.rows > 5 && r.cols > 10);
  assert.ok(out.text.startsWith(HIDE));
  assert.ok(out.text.endsWith(SHOW));
  assert.ok(out.text.includes(`\x1b[${r.rows}F`), "goes back up over its rows");
  assert.ok(out.text.includes("\x1b[38;"), "in colour");
  assert.ok(out.text.includes("v1\x1b[0m\n"), "the tagline once it has moved");
  assert.equal(process.listenerCount("SIGINT"), 0, "its listeners go");
});

test("intro: Ctrl+C ends the motion, and the cursor comes back", async () => {
  const out = new Fake();
  const p = intro("HELLO", { seconds: 5, out, env: TERM });
  await wait(150);
  process.emit("SIGINT");
  const r = await p;
  assert.equal(r.interrupted, true);
  assert.ok(out.text.endsWith(SHOW));
});

test("intro: a resize stops it where it is", async () => {
  const out = new Fake();
  const p = intro("HELLO", { seconds: 5, out, env: TERM });
  await wait(100);
  out.emit("resize");
  const r = await p;
  assert.equal(r.mode, "anim");
  assert.ok(out.text.endsWith(SHOW));
});

test("intro: NO_COLOR moves without colour", async () => {
  const out = new Fake();
  await intro("HI", { seconds: 0.2, tagline: "t", out, env: { ...TERM, NO_COLOR: "1" } });
  assert.ok(!/\x1b\[(38|39|2)[;m]/.test(out.text), "no colour codes");
  assert.ok(out.text.includes("F"), "still moves");
  assert.ok(out.text.endsWith("t\n" + SHOW));
});

test("intro: too narrow gets the words, too short gets one still frame", async () => {
  const narrow = new Fake({ columns: 12 });
  const a = await intro("HELLO WORLD", { out: narrow, env: TERM });
  assert.equal(a.mode, "plain");
  assert.equal(narrow.text, "HELLO WORLD\n");
  const short = new Fake({ rows: 5 });
  const b = await intro("HI", { out: short, env: TERM });
  assert.equal(b.mode, "static");
  assert.ok(!short.text.includes("F\x1b") && !short.text.includes(HIDE));
  const still = new Fake();
  assert.equal((await intro("HI", { seconds: 0, out: still, env: TERM })).mode, "static");
  assert.equal((await intro("HI", { out: new Fake(), env: { ...TERM, AMA_NO_MOTION: "1" } })).mode, "static");
});

test("intro: rejects a bad seconds and an empty spec", async () => {
  await assert.rejects(intro("HI", { seconds: -1, out: new Fake(), env: TERM }), /seconds/);
  await assert.rejects(intro({}, { out: new Fake(), env: TERM }), /kind/);
});

test("progress: plain logs each quarter and the end", () => {
  const out = new Fake({ tty: false });
  const bar = progress({ label: "Uploading", out, env: TERM });
  for (const v of [0.1, 0.3, 0.31, 0.6, 0.8, 1]) bar.update(v);
  bar.done("Uploaded");
  assert.equal(out.text, "Uploading 25%\nUploading 50%\nUploading 75%\n✓ Uploaded\n");
});

test("progress and spinner: draw in place, erase themselves, leave one line", async () => {
  const out = new Fake();
  const bar = progress({ label: "Uploading", cols: 30, out, env: TERM });
  bar.update(0.5);
  await wait(200);
  bar.done("Uploaded");
  assert.ok(out.text.startsWith(HIDE));
  assert.ok(out.text.includes("\x1b[2F"), "a two-row bar redraws over itself");
  assert.ok(out.text.endsWith("\x1b[2F\x1b[J\x1b[32m✓\x1b[0m Uploaded\n" + SHOW));
  const s = new Fake();
  const sp = spinner("Installing", { out: s, env: TERM });
  await wait(150);
  sp.text("Linking");
  await wait(100);
  sp.fail();
  assert.ok(s.text.includes("Linking"));
  assert.ok(s.text.endsWith("\x1b[1F\x1b[J\x1b[31m✗\x1b[0m Linking\n" + SHOW));
  assert.equal(process.listenerCount("SIGINT"), 0);
  const plain = new Fake({ tty: false });
  const p = spinner("Installing", { out: plain, env: TERM });
  p.succeed("Installed");
  assert.equal(plain.text, "Installing…\n✓ Installed\n");
});
