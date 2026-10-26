/*
 * Screenshot Lumino backgrounds in headless Chromium, to look at them without a browser.
 *
 *   npm run shots -w packages/lumino-ui -- [--url http://localhost:3000] [--card] [--wait 3000] [id ...]
 *
 * Needs the demo running (cd examples/next-demo && npx next dev -p 3000) and Chromium
 * or Chrome ($CHROME, one on the PATH, or the macOS app). WebGL runs on SwiftShader,
 * so it is slow but works without a GPU. Writes .shots/<id>-desktop.png (1440 x 900)
 * and .shots/<id>-phone.png (390 x 844); --card puts the sign-in card on top.
 * With no ids, it shoots every background in the registry.
 *
 * It drives the browser over the DevTools protocol in real time: the viewport is set
 * exactly (a plain --screenshot can capture a shorter viewport stretched to the
 * window, and its virtual time runs out before slow intros finish), and each shot
 * waits for the art to draw (its layer's opacity reaches 1), then --wait more ms.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [v] = args.splice(i, 2).slice(1);
  return v;
};
const url = flag("--url", "http://localhost:3000").replace(/\/$/, "");
const wait = Number(flag("--wait", "3000"));
const card = args.includes("--card") ? (args.splice(args.indexOf("--card"), 1), true) : false;

const MAC = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
function browser() {
  if (process.env.CHROME) return process.env.CHROME;
  if (fs.existsSync(MAC)) return MAC;
  for (const b of ["chromium", "chromium-browser", "google-chrome-stable", "google-chrome", "chrome"]) {
    try { if (spawnSync(b, ["--version"], { stdio: "ignore" }).status === 0) return b; } catch { /* next */ }
  }
  throw new Error("no Chromium or Chrome found: set $CHROME");
}

let ids = args;
if (!ids.length) {
  const { LUMINO_BACKGROUNDS } = await import("lumino-ui/backgrounds");
  ids = LUMINO_BACKGROUNDS.map((b) => b.id);
}

const out = path.join(root, ".shots");
fs.mkdirSync(out, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// One browser for every shot, driven over the DevTools protocol.
const port = 9300 + Math.floor(Math.random() * 600);
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lumino-shots-"));
const chrome = spawn(browser(), [
  "--headless=new", "--no-sandbox", "--hide-scrollbars", "--mute-audio", `--user-data-dir=${profile}`,
  "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
  `--remote-debugging-port=${port}`, "--window-size=1440,900", "about:blank",
], { stdio: "ignore" });
const exited = new Promise((r) => chrome.on("exit", r));
const quit = async () => {
  chrome.kill();
  await Promise.race([exited, sleep(5000)]);
  fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
};

let targets;
for (let i = 0; i < 100 && !targets; i++) {
  try { targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json(); } catch { await sleep(200); }
}
if (!targets) {
  await quit();
  throw new Error("the browser did not start");
}
const ws = new WebSocket(targets.find((t) => t.type === "page").webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener("open", r));
let seq = 0;
const pending = new Map();
ws.addEventListener("message", (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    pending.get(m.id)(m);
    pending.delete(m.id);
  }
});
const send = (method, params = {}) => new Promise((r) => {
  const id = ++seq;
  pending.set(id, r);
  ws.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => (await send("Runtime.evaluate", { expression, returnByValue: true })).result?.result?.value;

/** True once the background's art layer is fully faded in. */
const DRAWN = `(() => {
  const layer = document.querySelector("[data-lumino-bg] > [aria-hidden]");
  return !!layer && getComputedStyle(layer).opacity === "1";
})()`;

async function shoot(id, [w, h], name) {
  const file = path.join(out, `${id}-${name}${card ? "-card" : ""}.png`);
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${url}/lumino-bg/${id}?shot=1${card ? "&card=1" : ""}` });
  let drawn = false;
  for (let t = 0; t < 60000 && !drawn; t += 250) {
    await sleep(250);
    drawn = await evaluate(DRAWN);
  }
  await sleep(wait);
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (!shot.result?.data) {
    console.log(`FAIL ${path.relative(process.cwd(), file)}: no screenshot`);
    return false;
  }
  fs.writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log(`${drawn ? "ok  " : "slow"} ${path.relative(process.cwd(), file)}${drawn ? "" : " (the art never finished drawing: this may be the fallback)"}`);
  return drawn;
}

let failed = 0;
try {
  for (const id of ids) {
    for (const [size, name] of [[[1440, 900], "desktop"], [[390, 844], "phone"]]) {
      if (!(await shoot(id, size, name))) failed++;
    }
  }
} finally {
  ws.close();
  await quit();
}
process.exit(failed ? 1 : 0);
