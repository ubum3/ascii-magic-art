#!/usr/bin/env node
/*
 * validate-rest.mjs: every ascii.rest piece, through fromRest, held to the checks
 * scripts/validate.mjs holds ours to: exact cols x rows on every frame, a colour
 * layer of the same shape whose keys are all in the palette, no throws over 6
 * seconds, it animates (or is a still), and under 12 ms a frame.
 *
 *   node scripts/validate-rest.mjs            all of them
 *   node scripts/validate-rest.mjs rust zig   only these
 *
 * Characters outside the set that is one cell wide in every monospace font are
 * reported, not failed: they are ascii.rest's choice, and fine on a canvas.
 */
import { restNames, restPiece } from "../src/index.js";

const EXTRA = "·•●○◦■□▪▫◆◇▲△▼▽◀▶►◄≈≡°✓✗♥×÷±→←↑↓↗↘↙↖⟋⟍";
const okChar = (c) => {
  const n = c.codePointAt(0);
  return (n >= 32 && n <= 126) || (n >= 0x2500 && n <= 0x259f) || (n >= 0x2800 && n <= 0x28ff) || EXTRA.includes(c);
};
const want = process.argv.slice(2);
const names = restNames.filter((n) => !want.length || want.includes(n));
let bad = 0;
const odd = new Map();
for (const name of names) {
  const errs = [];
  try {
    const { meta: m, default: create } = await restPiece(name);
    const draw = create();
    const frames = [];
    let ms = 0, n = 0;
    for (let t = 0; t <= 6; t += 0.25) {
      const t0 = performance.now();
      const fr = draw(t);
      ms += performance.now() - t0; n++;
      const text = typeof fr === "string" ? fr : fr.text;
      const lines = text.split("\n");
      if (lines.length !== m.rows) { errs.push(`t=${t}: ${lines.length} rows, want ${m.rows}`); break; }
      const wrong = lines.findIndex((l) => [...l].length !== m.cols);
      if (wrong >= 0) { errs.push(`t=${t}: row ${wrong} is ${[...lines[wrong]].length} wide, want ${m.cols}`); break; }
      if (typeof fr === "object") {
        const cl = fr.color.split("\n");
        if (cl.length !== m.rows || cl.some((l) => [...l].length !== m.cols)) { errs.push(`t=${t}: colour layer shape differs`); break; }
        const missing = [...new Set(fr.color.replace(/[\n ]/g, ""))].filter((k) => !m.palette[k]);
        if (missing.length) { errs.push(`t=${t}: colour keys not in palette: ${missing.join("")}`); break; }
      }
      for (const c of text.replace(/\n/g, "")) if (!okChar(c)) odd.set(c, (odd.get(c) || new Set()).add(name));
      frames.push(text + (typeof fr === "object" ? fr.color : ""));
    }
    if (!errs.length) {
      if (new Set(frames).size < 3 && !m.still && !m.clock) errs.push("frames barely change and it is not a still");
      const avg = ms / n;
      if (avg > 12) errs.push(`slow: ${avg.toFixed(1)} ms per frame (limit 12)`);
    }
  } catch (e) {
    errs.push("throws: " + (e && e.stack ? e.stack.split("\n").slice(0, 2).join(" ") : e));
  }
  if (errs.length) { bad++; console.log(`FAIL rest-${name}\n  - ` + errs.join("\n  - ")); }
  else if (want.length) console.log(`ok   rest-${name}`);
}
if (odd.size) {
  console.log(`\ncharacters outside the monospace-safe set (fine on a canvas, may be wide in some terminals):`);
  for (const [c, s] of odd) console.log(`  ${c} U+${c.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}  ${[...s].slice(0, 6).join(", ")}${s.size > 6 ? `, +${s.size - 6}` : ""}`);
}
console.log(`\n${names.length - bad}/${names.length} ascii.rest pieces pass`);
process.exit(bad ? 1 : 0);
