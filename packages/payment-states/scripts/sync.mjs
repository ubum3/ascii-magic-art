#!/usr/bin/env node
/*
 * sync.mjs: copy src/states.json into the Go and Rust packages, which embed it
 * (go:embed and include_str! can't reach outside their own directories).
 *
 *   node scripts/sync.mjs           copy
 *   node scripts/sync.mjs --check   fail if a copy is out of date (npm test runs this)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = fs.readFileSync(path.join(ROOT, "src/states.json"));
const copies = ["go/states.json", "rust/states.json"];
const check = process.argv.includes("--check");
let stale = 0;
for (const rel of copies) {
  const p = path.join(ROOT, rel);
  const same = fs.existsSync(p) && fs.readFileSync(p).equals(src);
  if (check) { if (!same) { console.error(`${rel} is out of date: run npm run sync`); stale++; } continue; }
  if (!same) { fs.writeFileSync(p, src); console.log(`wrote ${rel}`); }
}
if (stale) process.exit(1);
