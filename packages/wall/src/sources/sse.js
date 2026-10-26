/*
 * sse.js: read events from a Server-Sent Events feed, in Node 18+ or a browser.
 *
 *   const stop = sseSource("https://events.example/feed", (e) => wall.push(e));
 *
 * Each `data:` message is JSON: one event, an array, or { events }. Events are
 * sanitized like webhook ones. It reconnects with backoff when the feed drops.
 */
import { sanitizeAll } from "./event.js";

/** A push parser: feed it text chunks, it calls onMessage(data) for each message. */
export function sseParser(onMessage) {
  let buf = "", data = [];
  return (chunk) => {
    buf += chunk;
    let nl;
    while ((nl = buf.search(/\r\n|\r|\n/)) >= 0) {
      const line = buf.slice(0, nl);
      buf = buf.slice(nl + (buf.startsWith("\r\n", nl) ? 2 : 1));
      if (line === "") { if (data.length) onMessage(data.join("\n")); data = []; continue; }
      if (line.startsWith(":")) continue;
      const i = line.indexOf(":"), field = i < 0 ? line : line.slice(0, i);
      let value = i < 0 ? "" : line.slice(i + 1);
      if (value.startsWith(" ")) value = value.slice(1);
      if (field === "data") data.push(value);
    }
  };
}

/** Reads `url` until stop() is called. headers: e.g. an Authorization for the feed. */
export function sseSource(url, onEvent, { headers = {}, fetch: f = globalThis.fetch, onError = () => {}, now = Date.now } = {}) {
  let stopped = false, ctrl, wait = 500;
  const run = async () => {
    while (!stopped) {
      try {
        ctrl = new AbortController();
        const res = await f(url, { headers: { accept: "text/event-stream", ...headers }, signal: ctrl.signal });
        if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
        wait = 500;
        const parse = sseParser((data) => {
          let body;
          try { body = JSON.parse(data); } catch { return; }
          for (const e of sanitizeAll(body, now())) onEvent(e);
        });
        const dec = new TextDecoder();
        for await (const chunk of res.body) parse(dec.decode(chunk, { stream: true }));
      } catch (err) {
        if (stopped) return;
        onError(err);
      }
      if (stopped) return;
      await new Promise((r) => setTimeout(r, wait));
      wait = Math.min(wait * 2, 15000);
    }
  };
  run();
  return () => { stopped = true; ctrl?.abort(); };
}
