#!/usr/bin/env node
/*
 * ama-wall: a live payments wall for office TVs.
 *
 *   ama-wall                          made-up payments (seeded), http://127.0.0.1:8787
 *   ama-wall --sse https://feed/x     events from an upstream SSE feed
 *   WALL_SECRET=... ama-wall --no-mock --host 0.0.0.0
 *                                     signed webhook events on POST /webhook
 *
 * Open the URL on the TV, or play it in a terminal with the ratatui or Bubble Tea
 * wall example (they read /layout.json and /state).
 */
import fs from "node:fs";
import { parseArgs } from "node:util";
import { createWall, createServer } from "../src/server.js";
import { mockSource } from "../src/sources/mock.js";
import { sseSource } from "../src/sources/sse.js";
import { appScript } from "../src/bundle.js";

const HELP = `ama-wall [options]

  --port <n>        port (default 8787)
  --host <addr>     address to listen on (default 127.0.0.1; 0.0.0.0 for the LAN)
  --mock / --no-mock  made-up payments (default on unless --sse or a secret is given)
  --seed <n>        mock seed (default 1)
  --rate <n>        mock auths a second (default 3)
  --sse <url>       read events from an SSE feed (repeatable)
  --secret <s>      enable POST /webhook, signed with this secret (or WALL_SECRET)
  --layout <file>   a layout spec to show instead of the default
  --title <text>    the default layout's title (default LIVE PAYMENTS)
`;

const { values: o } = parseArgs({
  options: {
    port: { type: "string", default: "8787" }, host: { type: "string", default: "127.0.0.1" },
    mock: { type: "boolean" }, "no-mock": { type: "boolean" }, seed: { type: "string", default: "1" }, rate: { type: "string", default: "3" },
    sse: { type: "string", multiple: true }, secret: { type: "string" }, layout: { type: "string" }, title: { type: "string", default: "LIVE PAYMENTS" },
    help: { type: "boolean", short: "h" },
  },
});
if (o.help) { process.stdout.write(HELP); process.exit(0); }

const secret = o.secret || process.env.WALL_SECRET || "";
const feeds = o.sse || [];
const mock = o["no-mock"] ? false : o.mock ?? (!feeds.length && !secret);
const layout = o.layout ? JSON.parse(fs.readFileSync(o.layout, "utf8")) : null;

const wall = createWall();
const stops = [];
if (mock) stops.push(mockSource({ seed: Number(o.seed) || 1, rate: Number(o.rate) || 3 }, (e) => wall.push(e)));
for (const url of feeds) stops.push(sseSource(url, (e) => wall.push(e), { onError: (e) => console.error(`sse: ${e.message}`) }));

const server = createServer({ wall, layout, title: o.title, secret, app: appScript });
server.listen(Number(o.port), o.host, () => {
  const where = `http://${o.host === "0.0.0.0" ? "localhost" : o.host}:${server.address().port}`;
  console.log(`ama-wall on ${where}`);
  console.log(`  sources: ${[mock && `mock (seed ${o.seed})`, ...feeds.map((u) => `sse ${u}`), secret && "webhook POST /webhook"].filter(Boolean).join(", ") || "none"}`);
});
const quit = () => { stops.forEach((s) => s()); server.closeAllConnections?.(); server.close(() => process.exit(0)); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);
