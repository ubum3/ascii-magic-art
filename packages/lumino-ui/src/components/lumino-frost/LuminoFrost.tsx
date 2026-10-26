"use client";
/*
 * LuminoFrost: the brandmark's three parts as huge frosted-glass slabs, the mark
 * pulled apart so the blades lean in from the sides and the base lies under the
 * card, drifting in parallax over warm light. The slabs are CSS glass
 * (backdrop-filter, clip-path from the mark's paths, a gradient edge), laid out by
 * CSS so the server HTML already shows them; a small 2D canvas paints the light.
 */
import { useId, useRef, type CSSProperties } from "react";
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { use2DScene } from "../../backgrounds/loop.js";
import { LUMINO_COLORS as C } from "../../brand/brand.js";
import { LIGHT, frostBeams, frostBlobs, frostFallback, globeDots } from "./light.js";
import { FROST_PARTS, frostCSS, partClipTransform, partPath, slabDrift } from "./layout.js";

export interface LuminoFrostProps extends LuminoBackgroundProps {
  /** Blur of the frosted glass, in CSS px. Default 22. */
  frost?: number;
}

/** A fine grain for the frosted surface, tiled. */
const GRAIN = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 0.09 0"/></filter><rect width="160" height="160" filter="url(#n)"/></svg>`,
)}")`;

const SCOPE: CSSProperties = { position: "absolute", inset: 0, containerType: "size", containerName: "lumino-frost", overflow: "hidden" };

const slabTransform = (x: number, y: number, rotate: number) => `translate(${x.toFixed(3)}cqmin, ${(-y).toFixed(3)}cqmin) rotate(${rotate.toFixed(3)}deg)`;
const sweepTransform = (sweep: number) => `translate(${(sweep * 3 - 1.5).toFixed(4)} 0)`;

/** Frosted-glass slabs in the brandmark's three shapes, drifting over warm light. */
export function LuminoFrost({ frost = 22, paused, speed, quality = 0.5, dpr, ...frame }: LuminoFrostProps) {
  const id = `lf${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const slabs = useRef<(HTMLDivElement | null)[]>([]);
  const sweeps = useRef<(SVGLinearGradientElement | null)[]>([]);

  const { boxRef, canvasRef, ready } = use2DScene((ctx) => ({
    draw({ time, width, height, pointer }) {
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = C.ground;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";
      const side = (width + height) / 2;
      for (const b of frostBlobs(time)) {
        const x = b.x * width, y = (1 - b.y) * height, r = b.r * side * 1.25;
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, withAlpha(b.color, b.a * LIGHT));
        g.addColorStop(0.45, withAlpha(b.color, b.a * LIGHT * 0.4));
        g.addColorStop(1, withAlpha(b.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
      // Two thin beams of light at the brand's 139deg, sweeping slowly: sharp in the
      // open, a soft smear behind the glass.
      for (const beam of frostBeams(time)) {
        ctx.save();
        ctx.translate(beam.x * width, (1 - beam.y) * height);
        ctx.rotate((49 * Math.PI) / 180);
        const w = Math.max(3, height * beam.width);
        const g = ctx.createLinearGradient(-w, 0, w, 0);
        g.addColorStop(0, withAlpha(beam.color, 0));
        g.addColorStop(0.5, withAlpha(beam.color, beam.a));
        g.addColorStop(1, withAlpha(beam.color, 0));
        ctx.fillStyle = g;
        ctx.fillRect(-w, -side * 2, w * 2, side * 4);
        ctx.restore();
      }
      // The dotted globe, turning slowly: it gives the frosted glass something to blur.
      const R = Math.max(width, height) * 0.62, cx = width / 2, cy = height * 0.56, dot = Math.max(1, height / 480);
      const dots = globeDots(time * 0.02, 64);
      for (let i = 0; i < dots.length; i += 3) {
        const z = dots[i + 2]!, s = dot * (0.6 + 0.6 * z);
        ctx.fillStyle = `rgba(255,236,228,${(0.05 + 0.12 * z).toFixed(3)})`;
        ctx.fillRect(cx + dots[i]! * R - s / 2, cy + dots[i + 1]! * R - s / 2, s, s);
      }
      // A calm middle for the card.
      ctx.globalCompositeOperation = "source-over";
      const calm = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, Math.min(width, height) * 0.55);
      calm.addColorStop(0, withAlpha(C.ground, 0.75));
      calm.addColorStop(1, withAlpha(C.ground, 0));
      ctx.fillStyle = calm;
      ctx.fillRect(0, 0, width, height);
      const px = pointer.inside ? pointer.x - 0.5 : 0, py = pointer.inside ? pointer.y - 0.5 : 0;
      FROST_PARTS.forEach((_, i) => {
        const d = slabDrift(i, time, px, py);
        const el = slabs.current[i];
        if (el) el.style.transform = slabTransform(d.x, d.y, d.rotate);
        sweeps.current[i]?.setAttribute("gradientTransform", sweepTransform(d.sweep));
      });
    },
  }), { paused, speed, quality, dpr });

  const glass: CSSProperties = {
    position: "absolute",
    backdropFilter: `blur(${frost}px) saturate(170%) brightness(1.18)`,
    WebkitBackdropFilter: `blur(${frost}px) saturate(170%) brightness(1.18)`,
    background: `${GRAIN}, linear-gradient(160deg, rgba(255,255,255,0.13), rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.07))`,
    willChange: "transform",
  };

  const art = (
    <div className={id} style={SCOPE}>
      <style>{frostCSS(`.${id}`)}</style>
      <canvas ref={canvasRef} style={{ ...FILL_CANVAS, opacity: ready ? 1 : 0, transition: "opacity 900ms ease" }} />
      <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true" focusable="false">
        <defs>
          {FROST_PARTS.map((p, i) => (
            <clipPath key={i} id={`${id}c${i}`} clipPathUnits="objectBoundingBox">
              <path d={partPath(p)} transform={partClipTransform(p)} />
            </clipPath>
          ))}
        </defs>
      </svg>
      {FROST_PARTS.map((p, i) => {
        const d = slabDrift(i, 0);
        const [x, y, w, h] = p.box;
        return (
          <div
            key={i}
            data-part={i}
            ref={(el) => { slabs.current[i] = el; }}
            style={{ ...glass, clipPath: `url(#${id}c${i})`, transform: slabTransform(d.x, d.y, d.rotate) }}
          >
            <svg viewBox={`${x} ${y} ${w} ${h}`} preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              <defs>
                <linearGradient id={`${id}e${i}`} x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor={C.peach} stopOpacity="0.9" />
                  <stop offset="0.35" stopColor={C.coral} stopOpacity="0.55" />
                  <stop offset="0.65" stopColor={C.blue} stopOpacity="0.5" />
                  <stop offset="1" stopColor={C.lavender} stopOpacity="0.85" />
                </linearGradient>
                <linearGradient ref={(el) => { sweeps.current[i] = el; }} id={`${id}s${i}`} x1="0" y1="0" x2="1" y2="0.6" gradientTransform={sweepTransform(d.sweep)}>
                  <stop offset="0.4" stopColor="#fff" stopOpacity="0" />
                  <stop offset="0.5" stopColor="#fff" stopOpacity="0.95" />
                  <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={partPath(p)} fill="none" stroke={`url(#${id}e${i})`} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              <path d={partPath(p)} fill="none" stroke={`url(#${id}s${i})`} strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
        );
      })}
    </div>
  );

  // The slabs are real DOM, so they show from the first paint: the frame is "ready"
  // at once and only the canvas light fades in over the CSS fallback.
  return <BackgroundFrame fallback={frostFallback()} {...frame} artRef={boxRef} ready art={art} />;
}

/** #rrggbb plus an alpha, as rgba(). */
function withAlpha(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}
