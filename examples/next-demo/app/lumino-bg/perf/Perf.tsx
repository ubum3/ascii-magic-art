"use client";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { LUMINO_BACKGROUNDS } from "lumino-ui/backgrounds";
import { Live } from "../Live";
import { installProbe, stats, type Probe } from "./probe";

const WARMUP_MS = 1500;
const BUDGET_MS = 4;

interface Result {
  id: string;
  /** Frames measured. */
  frames: number;
  /** rAF interval, ms. */
  interval: { avg: number; p95: number };
  /** Share of intervals over 16.7 ms. */
  slow: number;
  /** GPU ms per frame, or null without a timer. */
  gpu: { avg: number; p95: number } | null;
  /** CPU ms per frame in the background's rAF callbacks, or null if none were seen. */
  cpu: { avg: number; p95: number } | null;
  longTasks: number;
  /** The background's canvas size in device pixels, if it has one. */
  canvas: string;
  /** Why there is no GPU time. */
  note?: string;
}

const ms = (x: number | undefined) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(2));

function environment() {
  const env: Record<string, string | number> = {
    viewport: `${innerWidth}x${innerHeight}`,
    dpr: devicePixelRatio,
    userAgent: navigator.userAgent,
  };
  try {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl?.getExtension("WEBGL_debug_renderer_info");
    env.gpu = gl ? String(gl.getParameter(info ? info.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : "no WebGL2";
    env.timerQuery = gl?.getExtension("EXT_disjoint_timer_query_webgl2") ? "yes" : "no";
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    env.gpu = "unknown";
  }
  return env;
}

/** Runs each background full screen in turn and tabulates its frame times. */
export function Perf() {
  const [ids, setIds] = useState<string[] | null>(null);
  const [seconds, setSeconds] = useState(5);
  const [current, setCurrent] = useState<{ id: string; phase: string } | null>(null);
  const [results, setResults] = useState<Result[]>([]);
  const [env, setEnv] = useState<Record<string, string | number> | null>(null);
  const [run, setRun] = useState(0);
  const [copied, setCopied] = useState(false);
  const stage = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = new URLSearchParams(location.search);
    const want = q.get("ids")?.split(",").filter(Boolean);
    setIds(LUMINO_BACKGROUNDS.map((b) => b.id).filter((id) => !want?.length || want.includes(id)));
    setSeconds(Math.max(1, Number(q.get("seconds")) || 5));
    setEnv(environment());
    if (q.has("run")) setRun(1);
  }, []);

  useEffect(() => {
    if (!ids || !run) return undefined;
    const probe: Probe = installProbe();
    let cancelled = false, longTasks = 0;
    const lt = typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")
      ? new PerformanceObserver((list) => (longTasks += list.getEntries().length))
      : null;
    lt?.observe({ type: "longtask", buffered: false });
    const wait = (t: number) => new Promise((r) => setTimeout(r, t));

    (async () => {
      setResults([]);
      for (const id of ids) {
        if (cancelled) return;
        setCurrent({ id, phase: "warming up" });
        await wait(WARMUP_MS);
        if (cancelled) return;
        setCurrent({ id, phase: "measuring" });
        probe.reset();
        longTasks = 0;
        const intervals: number[] = [];
        await new Promise<void>((done) => {
          let last = 0;
          const end = performance.now() + seconds * 1000;
          const tick = (now: number) => {
            if (cancelled) return done();
            if (last) intervals.push(now - last);
            last = now;
            probe.poll();
            if (now < end) probe.raf(tick);
            else done();
          };
          probe.raf(tick);
        });
        await wait(200);
        probe.poll();
        const canvas = stage.current?.querySelector("canvas");
        const timer = probe.hasTimer() && probe.gpu.length > 0;
        const note = timer ? undefined : !probe.sawWebGL() ? "no GPU timer (not WebGL2; CPU time leaves out raster)" : "no GPU timer (extension missing)";
        const cpu = probe.cpu.filter((x) => x > 0);
        setResults((r) => [...r, {
          id,
          frames: intervals.length,
          interval: stats(intervals),
          slow: intervals.length ? intervals.filter((x) => x > 1000 / 60 + 1).length / intervals.length : 0,
          gpu: timer ? stats(probe.gpu) : null,
          cpu: cpu.length ? stats(cpu) : null,
          longTasks,
          canvas: canvas ? `${canvas.width}x${canvas.height}` : "—",
          note,
        }]);
      }
      setCurrent(null);
    })();

    return () => {
      cancelled = true;
      lt?.disconnect();
      probe.restore();
    };
  }, [ids, seconds, run]);

  const json = JSON.stringify({ env, seconds, results }, null, 2);
  const cell: CSSProperties = { padding: "4px 10px", textAlign: "right", whiteSpace: "nowrap" };

  return (
    <div>
      <h1>Lumino backgrounds: frame times</h1>
      <p style={{ opacity: 0.7, maxWidth: 760 }}>
        Each background runs full screen for {WARMUP_MS / 1000} s of warm-up, then {seconds} s of measuring. GPU time comes from
        WebGL2 timer queries where the browser has them; the rAF interval is capped by the display's refresh, so it can't tell a cheap
        background from a costly one under the cap. Budget: {BUDGET_MS} ms a frame. ?ids=a,b and ?seconds=n narrow a run; ?run starts it on load.
      </p>
      {env && <p style={{ opacity: 0.6, fontSize: 13 }}>{String(env.gpu)} · timer queries: {String(env.timerQuery)} · {String(env.viewport)} @ {String(env.dpr)}x</p>}
      <p>
        <button onClick={() => setRun((n) => n + 1)} disabled={!!current || !ids}>{run ? "Run again" : "Run"}</button>{" "}
        <button onClick={() => navigator.clipboard?.writeText(json).then(() => setCopied(true))} disabled={!results.length}>
          {copied ? "Copied" : "Copy as JSON"}
        </button>
      </p>
      {results.length > 0 && (
        <table style={{ borderCollapse: "collapse", fontVariantNumeric: "tabular-nums", fontSize: 14 }}>
          <thead>
            <tr style={{ opacity: 0.7 }}>
              <th style={{ ...cell, textAlign: "left" }}>background</th>
              <th style={cell}>GPU avg</th>
              <th style={cell}>GPU p95</th>
              <th style={cell}>CPU avg</th>
              <th style={cell}>rAF avg</th>
              <th style={cell}>rAF p95</th>
              <th style={cell}>&gt;16.7 ms</th>
              <th style={cell}>long tasks</th>
              <th style={cell}>canvas</th>
              <th style={{ ...cell, textAlign: "left" }}>note</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid #ffffff1a" }}>
                <td style={{ ...cell, textAlign: "left" }}>{r.id}</td>
                <td style={{ ...cell, color: r.gpu && r.gpu.avg > BUDGET_MS ? "#EF5C47" : undefined }}>{ms(r.gpu?.avg)}</td>
                <td style={cell}>{ms(r.gpu?.p95)}</td>
                <td style={cell}>{ms(r.cpu?.avg)}</td>
                <td style={cell}>{ms(r.interval.avg)}</td>
                <td style={cell}>{ms(r.interval.p95)}</td>
                <td style={cell}>{(r.slow * 100).toFixed(0)}%</td>
                <td style={cell}>{r.longTasks}</td>
                <td style={cell}>{r.canvas}</td>
                <td style={{ ...cell, textAlign: "left", opacity: 0.6 }}>{r.note ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {current && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100 }}>
          <div ref={stage} style={{ position: "absolute", inset: 0 }}>
            <Live key={current.id} id={current.id} style={{ width: "100%", height: "100%" }} />
          </div>
          <div style={{ position: "absolute", left: 12, top: 12, padding: "4px 10px", borderRadius: 6, background: "#000a", font: "13px ui-monospace, monospace" }}>
            {current.id} · {current.phase} · {results.length + 1}/{ids?.length}
          </div>
        </div>
      )}
    </div>
  );
}
