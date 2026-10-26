"use client";
/*
 * ArcConduit: a large, faint glass brandmark low on the right, partly off the box,
 * with electric arcs crawling along its outlines. Now and then one jumps the gap
 * between a blade and the base in a branching bolt with a flash. The light leaves
 * a short afterglow, and the arcs shed dim ASCII glyphs that drift and fade.
 * Canvas 2D: a static layer (glows and the glass mark), a fading trail layer the
 * arcs draw into, and the live glyphs and flashes on top.
 */
import { useRef } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { use2DScene } from "../../backgrounds/loop.js";
import { BRANDMARK, LUMINO_COLORS, LUMINO_STOPS } from "../../brand/brand.js";
import { brandmarkPaths } from "../../brand/mark.js";
import { bolt, nearest, parsePath, perimeter, resample, rng, type Pt } from "./outline.js";

export interface ArcConduitProps extends LuminoBackgroundProps {
  /** How many arcs crawl along the outlines. Default 4. */
  arcs?: number;
  /** Average seconds between jumps across a gap. Default 1.8. */
  jumpEvery?: number;
  /** Arcs shed dim ASCII glyphs as they go. Default true. */
  glyphs?: boolean;
}

const { ground, peach, coral, blue, lavender, plum, indigo } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(40% 50% at 80% 78%, ${coral}30, transparent 70%)`,
  `radial-gradient(30% 40% at 74% 60%, ${blue}38, transparent 70%)`,
  `radial-gradient(50% 50% at 0% 0%, ${indigo}66, transparent 70%)`,
  ground,
].join(", ");

/** The mark's tight box on a w x h canvas: its scale (canvas px per viewBox unit) and the canvas position of the box centre. */
export function conduitLayout(w: number, h: number): { scale: number; cx: number; cy: number } {
  const [, , bw, bh] = BRANDMARK.bounds;
  const portrait = w / h < 0.8;
  const scale = portrait ? (w * 0.9) / bw : (h * 0.7) / bh;
  return { scale, cx: w - bw * scale * (portrait ? 0.4 : 0.45), cy: h - bh * scale * (portrait ? 0.36 : 0.42) };
}

const GLYPHS = ".:-=+*#%@";
const COLORS = [[coral, peach], [blue, lavender], [peach, "#fff"], [lavender, "#fff"]] as const;

interface Crawler { part: number; pos: number; vel: number; len: number; color: number; shed: number }
interface Bolt { paths: Pt[][]; age: number; life: number }
interface Glyph { x: number; y: number; ch: string; age: number; life: number; color: string }

/** Electric arcs crawling over a big glass brandmark, jumping its gaps. */
export function ArcConduit({ arcs = 4, jumpEvery = 1.8, glyphs = true, paused, speed, quality = 0.75, dpr, ...frame }: ArcConduitProps) {
  const settings = useRef({ jumpEvery, glyphs });
  settings.current = { jumpEvery, glyphs };
  const { boxRef, canvasRef, ready } = use2DScene((ctx) => {
    const rand = rng(7);
    const shapes = BRANDMARK.paths.map((d) => parsePath(d)[0]!);
    const counts = shapes.map((s) => Math.round(perimeter(s) / 7));
    const base = shapes.map((s, i) => resample(s, counts[i]!));
    const paths = brandmarkPaths();
    const still = document.createElement("canvas"), trail = document.createElement("canvas");
    const sctx = still.getContext("2d")!, tctx = trail.getContext("2d")!;
    let W = 0, H = 0, unit = 1, outlines: Pt[][] = [], markW = 1, nextJump = 0.6;
    const crawlers: Crawler[] = Array.from({ length: Math.max(1, Math.min(8, arcs)) }, (_, i) => ({
      part: i % 3, pos: rand() * 400, vel: (rand() < 0.5 ? -1 : 1) * (30 + rand() * 40), len: 40 + rand() * 40, color: i % COLORS.length, shed: 0,
    }));
    const bolts: Bolt[] = [], flashes: { x: number; y: number; age: number }[] = [], dust: Glyph[] = [];

    const layout = (w: number, h: number) => {
      W = w;
      H = h;
      still.width = trail.width = w;
      still.height = trail.height = h;
      const { scale, cx, cy } = conduitLayout(w, h);
      const [bx, by, bw, bh] = BRANDMARK.bounds;
      const ox = cx - (bx + bw / 2) * scale, oy = cy - (by + bh / 2) * scale;
      markW = bw * scale;
      outlines = base.map((pts) => pts.map(([x, y]) => [ox + x * scale, oy + y * scale] as Pt));

      // The still layer: brand glows, then the mark as faint glass with a thin gradient edge.
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      sctx.fillStyle = ground;
      sctx.fillRect(0, 0, w, h);
      const glow = (x: number, y: number, r: number, c: string, a: string) => {
        const g = sctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, c + a);
        g.addColorStop(1, c + "00");
        sctx.fillStyle = g;
        sctx.fillRect(0, 0, w, h);
      };
      glow(cx, cy, markW * 0.9, coral, "3a");
      glow(cx - markW * 0.1, cy - markW * 0.4, markW * 0.6, blue, "38");
      glow(0, 0, Math.max(w, h) * 0.6, indigo, "40");
      glow(w * 0.1, h, Math.max(w, h) * 0.4, plum, "30");
      const grad = sctx.createLinearGradient(ox + bx * scale, oy + by * scale, ox + (bx + bw) * scale, oy + (by + bh) * scale);
      for (const [c, p] of LUMINO_STOPS) grad.addColorStop(p, c);
      sctx.setTransform(scale, 0, 0, scale, ox, oy);
      sctx.globalAlpha = 0.22;
      sctx.filter = `blur(${(markW * 0.04) / scale}px)`;
      sctx.fillStyle = grad;
      for (const p of paths) sctx.fill(p);
      sctx.filter = "none";
      sctx.globalAlpha = 0.1;
      for (const p of paths) sctx.fill(p);
      sctx.strokeStyle = grad;
      sctx.globalAlpha = 0.45;
      sctx.filter = `blur(${(unit * 4) / scale}px)`;
      sctx.lineWidth = (unit * 5) / scale;
      for (const p of paths) sctx.stroke(p);
      sctx.filter = "none";
      sctx.globalAlpha = 0.95;
      sctx.lineWidth = (unit * 1.5) / scale;
      for (const p of paths) sctx.stroke(p);
      sctx.globalAlpha = 1;
      sctx.setTransform(1, 0, 0, 1, 0, 0);
      tctx.clearRect(0, 0, w, h);
    };

    const point = (part: number, i: number): Pt => {
      const pts = outlines[part]!, n = pts.length;
      return pts[((Math.floor(i) % n) + n) % n]!;
    };
    const stroke = (pts: readonly Pt[], [glowC, coreC]: readonly [string, string], alpha: number, width: number) => {
      tctx.beginPath();
      tctx.moveTo(pts[0]![0], pts[0]![1]);
      for (let i = 1; i < pts.length; i++) tctx.lineTo(pts[i]![0], pts[i]![1]);
      tctx.strokeStyle = glowC;
      tctx.globalAlpha = alpha * 0.16;
      tctx.lineWidth = width * 9;
      tctx.stroke();
      tctx.globalAlpha = alpha * 0.5;
      tctx.lineWidth = width * 3;
      tctx.stroke();
      tctx.strokeStyle = coreC;
      tctx.globalAlpha = alpha * 0.9;
      tctx.lineWidth = width;
      tctx.stroke();
    };
    const shed = (x: number, y: number, color: string) => {
      if (!settings.current.glyphs || dust.length > 180) return;
      dust.push({ x, y, ch: GLYPHS[Math.floor(rand() * GLYPHS.length)]!, age: 0, life: 0.9 + rand() * 1.1, color });
    };
    const jump = () => {
      const c = crawlers[Math.floor(rand() * crawlers.length)]!;
      const a = point(c.part, c.pos + c.len / 2);
      let best: Pt | null = null, bd = Infinity;
      for (let p = 0; p < outlines.length; p++) {
        if (p === c.part) continue;
        const q = outlines[p]![nearest(outlines[p]!, a)]!, d = Math.hypot(q[0] - a[0], q[1] - a[1]);
        if (d < bd) [best, bd] = [q, d];
      }
      if (!best || bd > markW * 0.45) return;
      const main = bolt(a, best, rand, 5, 0.24), list = [main];
      for (let b = 0; b < 2; b++) {
        const from = main[6 + Math.floor(rand() * 18)]!, ang = Math.atan2(best[1] - a[1], best[0] - a[0]) + (rand() - 0.5) * 2.2;
        const len = Math.max(bd, markW * 0.08) * (0.3 + rand() * 0.3);
        list.push(bolt(from, [from[0] + Math.cos(ang) * len, from[1] + Math.sin(ang) * len], rand, 4, 0.3));
      }
      bolts.push({ paths: list, age: 0, life: 0.32 });
      flashes.push({ x: (a[0] + best[0]) / 2, y: (a[1] + best[1]) / 2, age: 0 });
      for (let i = 0; i < 14; i++) {
        const p = main[Math.floor(rand() * main.length)]!;
        shed(p[0], p[1], lavender);
      }
    };

    return {
      draw({ time, dt, width, height, cssWidth, still: frozen }) {
        unit = width / cssWidth;
        // Paused: the canvas still holds the last frame, so leave it (unless it was resized).
        if (!dt && !frozen && width === W && height === H) return;
        if (width !== W || height !== H) layout(width, height);
        if (frozen && !bolts.length) jump();

        // Fade the trail for the afterglow.
        tctx.globalCompositeOperation = "destination-out";
        tctx.globalAlpha = 1 - Math.exp(-dt * 7);
        tctx.fillStyle = "#000";
        tctx.fillRect(0, 0, W, H);
        tctx.globalCompositeOperation = "lighter";
        tctx.lineJoin = tctx.lineCap = "round";

        for (const c of crawlers) {
          c.pos += c.vel * dt;
          if (rand() < dt * 0.15) c.vel *= -1;
          const pts: Pt[] = [], amp = unit * 5;
          for (let j = 0; j <= c.len; j += 2) {
            const p = point(c.part, c.pos + j), q = point(c.part, c.pos + j + 1);
            const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
            const off = (rand() - 0.5) * 2 * amp * Math.sin((Math.PI * j) / c.len);
            pts.push([p[0] - (dy / len) * off, p[1] + (dx / len) * off]);
          }
          stroke(pts, COLORS[c.color]!, 0.6 + 0.4 * rand(), unit * 1.4);
          c.shed += dt;
          if (c.shed > 0.12) {
            c.shed = 0;
            const p = pts[Math.floor(rand() * pts.length)]!;
            shed(p[0], p[1], COLORS[c.color]![0]);
          }
        }

        if (!frozen && time > nextJump) {
          jump();
          nextJump = time + settings.current.jumpEvery * (0.4 + rand() * 1.2);
        }
        for (let i = bolts.length - 1; i >= 0; i--) {
          const b = bolts[i]!;
          const k = 1 - b.age / b.life, flicker = 0.5 + 0.5 * rand();
          b.paths.forEach((p, j) => stroke(p, [coral, "#fff"], k * flicker * (j ? 0.6 : 1), unit * (j ? 0.9 : 1.5)));
          b.age += frozen ? 0 : dt;
          if (b.age > b.life) bolts.splice(i, 1);
        }

        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
        ctx.drawImage(still, 0, 0);
        ctx.globalCompositeOperation = "lighter";
        ctx.drawImage(trail, 0, 0);
        for (let i = flashes.length - 1; i >= 0; i--) {
          const f = flashes[i]!, r = markW * 0.35;
          const g = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, r);
          g.addColorStop(0, peach);
          g.addColorStop(1, peach + "00");
          ctx.globalAlpha = 0.22 * Math.max(0, 1 - f.age / 0.5);
          ctx.fillStyle = g;
          ctx.fillRect(f.x - r, f.y - r, r * 2, r * 2);
          f.age += dt;
          if (f.age > 0.5) flashes.splice(i, 1);
        }
        ctx.font = `${Math.round(10 * unit)}px ui-monospace, Menlo, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        for (let i = dust.length - 1; i >= 0; i--) {
          const g = dust[i]!, k = 1 - g.age / g.life;
          ctx.globalAlpha = 0.5 * k * k;
          ctx.fillStyle = g.color;
          ctx.fillText(g.ch, g.x, g.y);
          g.y -= dt * 9 * unit;
          g.age += dt;
          if (g.age > g.life) dust.splice(i, 1);
        }
        ctx.globalAlpha = 1;
        ctx.globalCompositeOperation = "source-over";
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame {...frame} fallback={FALLBACK} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
