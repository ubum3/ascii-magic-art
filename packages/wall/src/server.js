/*
 * server.js: the wall as an HTTP server. Events come in (mock, an upstream SSE
 * feed, the signed webhook); the reducer turns them into one layout state; every
 * screen gets the layout once and the state as a stream.
 *
 *   GET  /              the React page (web/app.jsx)
 *   GET  /layout.json   the layout spec; ?cols=&rows= sizes the default one
 *   GET  /state         SSE: the layout state, ~10 a second while it changes
 *   GET  /events        SSE: clean events, as they arrive
 *   POST /webhook       signed events (only with a secret)
 *   GET  /healthz
 */
import http from "node:http";
import { initial, reduce, tick, view } from "./reduce.js";
import { wallLayout } from "./screen.js";
import { webhookHandler } from "./sources/webhook.js";

const PAGE = (title) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title.replace(/[<&>"]/g, "")}</title>
<style>html,body,#wall{margin:0;height:100%;background:#0d1117;overflow:hidden;cursor:none}</style>
</head><body><div id="wall"></div><script type="module" src="/app.js"></script></body></html>`;

/**
 * The wall's state machine without HTTP: push(events), subscribe(fn) for states.
 * `now` is the clock tick() runs on.
 */
export function createWall({ now = Date.now } = {}) {
  let s = initial(now());
  const subs = new Set(), eventSubs = new Set();
  let last = "";
  const emit = () => {
    const json = JSON.stringify(view(s));
    if (json === last) return;
    last = json;
    for (const fn of subs) fn(json);
  };
  return {
    push(events) {
      for (const e of Array.isArray(events) ? events : [events]) {
        s = reduce(s, e);
        const json = JSON.stringify(e);
        for (const fn of eventSubs) fn(json);
      }
    },
    /** Roll the clock and send the state if it changed. The server calls it ~10 times a second. */
    tick() { s = tick(s, now()); emit(); },
    state: () => view(s),
    stateJSON: () => last || JSON.stringify(view(s)),
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn); },
    subscribeEvents(fn) { eventSubs.add(fn); return () => eventSubs.delete(fn); },
  };
}

const sse = (req, res, first) => {
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive", "x-accel-buffering": "no" });
  res.write("retry: 1000\n\n");
  if (first) res.write(`data: ${first}\n\n`);
  const ping = setInterval(() => res.write(": ping\n\n"), 15000);
  req.on("close", () => clearInterval(ping));
  return (data) => res.write(`data: ${data}\n\n`);
};

/**
 * An http.Server for a wall. app: the page's script (string or () => Promise<string>).
 * layout: a fixed layout spec, or null for the default one sized per request.
 */
export function createServer({ wall, layout = null, title = "LIVE PAYMENTS", secret, app, tolerance } = {}) {
  const hook = secret ? webhookHandler({ secret, tolerance, onEvents: (es) => wall.push(es) }) : null;
  let script;
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://wall");
    try {
      switch (url.pathname) {
        case "/":
          res.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE(title));
          return;
        case "/app.js":
          script ??= typeof app === "function" ? app() : app;
          res.writeHead(200, { "content-type": "text/javascript; charset=utf-8", "cache-control": "no-cache" }).end(await script);
          return;
        case "/layout.json": {
          const n = (k) => (url.searchParams.has(k) ? Number(url.searchParams.get(k)) || undefined : undefined);
          const spec = layout || wallLayout({ cols: n("cols"), rows: n("rows"), title });
          res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" }).end(JSON.stringify(spec));
          return;
        }
        case "/state": {
          const send = sse(req, res, wall.stateJSON());
          req.on("close", wall.subscribe(send));
          return;
        }
        case "/events": {
          const send = sse(req, res);
          req.on("close", wall.subscribeEvents(send));
          return;
        }
        case "/webhook":
          if (!hook) { res.writeHead(404).end("no webhook: start with a secret\n"); return; }
          hook(req, res);
          return;
        case "/healthz":
          res.writeHead(200, { "content-type": "text/plain" }).end("ok\n");
          return;
        default:
          res.writeHead(404).end();
      }
    } catch (err) {
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end(String(err && err.message ? err.message : err) + "\n");
    }
  });
  const timer = setInterval(() => wall.tick(), 100);
  server.on("close", () => clearInterval(timer));
  return server;
}
