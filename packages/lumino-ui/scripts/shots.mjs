/*
 * Screenshot Lumino backgrounds in headless Chromium, to look at them without a browser.
 *
 *   npm run shots -w packages/lumino-ui -- [--url http://localhost:3000] [--card] [--wait 4000] [id ...]
 *
 * Needs the demo running (cd examples/next-demo && npx next dev -p 3000) and Chromium
 * or Chrome ($CHROME, one on the PATH, or the macOS app). WebGL runs on SwiftShader,
 * so it is slow but works without a GPU. Writes .shots/<id>-desktop.png (1440 x 900)
 * and .shots/<id>-phone.png (390 x 844); --card puts the sign-in card on top.
 * With no ids, it shoots every background in the registry.
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
const wait = Number(flag("--wait", "4000"));
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

const chrome = browser(), out = path.join(root, ".shots");
fs.mkdirSync(out, { recursive: true });

function shoot(id, [w, h], name) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "lumino-shots-"));
  const file = path.join(out, `${id}-${name}${card ? "-card" : ""}.png`);
  const page = `${url}/lumino-bg/${id}${card ? "?card=1" : ""}`;
  return new Promise((resolve) => {
    const p = spawn(chrome, [
      "--headless=new", "--no-sandbox", "--hide-scrollbars", "--mute-audio", `--user-data-dir=${profile}`,
      "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist",
      `--window-size=${w},${h}`, `--virtual-time-budget=${wait}`, `--screenshot=${file}`, page,
    ], { stdio: "ignore" });
    const timer = setTimeout(() => p.kill("SIGKILL"), wait + 60000);
    p.on("exit", () => {
      clearTimeout(timer);
      fs.rmSync(profile, { recursive: true, force: true });
      const ok = fs.existsSync(file);
      console.log(`${ok ? "ok  " : "FAIL"} ${path.relative(process.cwd(), file)}`);
      resolve(ok);
    });
  });
}

let failed = 0;
for (const id of ids) {
  for (const [size, name] of [[[1440, 900], "desktop"], [[390, 844], "phone"]]) {
    if (!(await shoot(id, size, name))) failed++;
  }
}
process.exit(failed ? 1 : 0);
