"use client";
/*
 * EtherImprint: a small fluid simulation of warm nebula dye on the near-black ground.
 * Every few seconds the brandmark is stamped into it, dye and an outward push at once,
 * so it blooms, curls apart and dissolves back into the ether. Soft emitters near the
 * edges keep it alive between imprints, and the pointer stirs it.
 */
import { BackgroundFrame, FILL_CANVAS, type LuminoBackgroundProps } from "../../backgrounds/frame.js";
import { useGLScene } from "../../backgrounds/loop.js";
import { bindTexture, drawFullscreen, link, markSDFTexture, markSpreadDefine, paletteTexture, rgb, type Program } from "../../backgrounds/gl.js";
import { LUMINO_COLORS, LUMINO_PALETTE } from "../../brand/brand.js";
import { brandmarkSDF } from "../../brand/mark.js";
import { ADVECT, COPY, CURL, DISPLAY, DIVERGENCE, GRADIENT, IMPRINT, PRESSURE, SCALE, SPLAT, VORTICITY } from "./glsl.js";
import { imprintAt } from "./schedule.js";

export interface EtherImprintProps extends LuminoBackgroundProps {
  /** Seconds between imprints. Default 8. */
  period?: number;
  /** The pointer stirs the ether. Default true. */
  interactive?: boolean;
}

const { ground, peach, coral, plum, blue, lavender } = LUMINO_COLORS;
const FALLBACK = [
  `radial-gradient(22% 30% at 80% 64%, ${peach}40, transparent 70%)`,
  `radial-gradient(35% 40% at 78% 70%, ${coral}30, transparent 70%)`,
  `radial-gradient(40% 45% at 15% 25%, ${blue}38, transparent 70%)`,
  `radial-gradient(35% 40% at 25% 85%, ${plum}50, transparent 70%)`,
  `radial-gradient(30% 30% at 95% 5%, ${lavender}20, transparent 70%)`,
  ground,
].join(", ");

interface Target { tex: WebGLTexture; fbo: WebGLFramebuffer; w: number; h: number }
interface Double { read: Target; write: Target; swap(): void }

const SIM = 128;             // cells on the short side
const DYE = 480;             // dye pixels on the short side, at most
const STEP = 1 / 60;
const WARM_UP = 1.4;         // seconds simulated before the first frame shows

/** Warm nebula dye in a live fluid, with the brandmark blooming into it and dissolving. */
export function EtherImprint({ period = 8, interactive = true, paused, speed, quality = 0.6, dpr, ...frame }: EtherImprintProps) {
  const { boxRef, canvasRef, ready } = useGLScene((gl) => {
    if (!gl.getExtension("EXT_color_buffer_float")) return null;
    gl.getExtension("OES_texture_float_linear");
    const sdf = brandmarkSDF(512, { padding: 0.12, spread: 48 });
    const P = {
      advect: link(gl, ADVECT), divergence: link(gl, DIVERGENCE), curl: link(gl, CURL), vorticity: link(gl, VORTICITY),
      pressure: link(gl, PRESSURE), gradient: link(gl, GRADIENT), scale: link(gl, SCALE), splat: link(gl, SPLAT),
      imprint: link(gl, IMPRINT(markSpreadDefine(sdf))), copy: link(gl, COPY), display: link(gl, DISPLAY),
    };
    const palette = paletteTexture(gl), mark = markSDFTexture(gl, sdf);
    const brand = LUMINO_PALETTE.map(rgb);

    const make = (w: number, h: number, internal: number, format: number, mips = false): Target => {
      const tex = gl.createTexture()!;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, internal, w, h, 0, format, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (mips) gl.generateMipmap(gl.TEXTURE_2D);
      const fbo = gl.createFramebuffer()!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return { tex, fbo, w, h };
    };
    const double = (w: number, h: number, internal: number, format: number, mips = false): Double => {
      const d: Double = { read: make(w, h, internal, format, mips), write: make(w, h, internal, format, mips), swap() { [d.read, d.write] = [d.write, d.read]; } };
      return d;
    };
    const free = (t: Target) => {
      gl.deleteTexture(t.tex);
      gl.deleteFramebuffer(t.fbo);
    };
    const RGBA = [gl.RGBA16F, gl.RGBA] as const, R = [gl.R16F, gl.RED] as const;

    let velocity: Double | null = null, dye: Double | null = null, pressure: Double | null = null;
    let divergence: Target | null = null, curl: Target | null = null;
    let simTexel: [number, number] = [1, 1], aspect = 1;

    const run = (prog: Program, target: Target | null, uniforms: (u: Program["u"]) => void, w?: number, h?: number) => {
      gl.useProgram(prog.program);
      uniforms(prog.u);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target ? target.fbo : null);
      gl.viewport(0, 0, target ? target.w : w!, target ? target.h : h!);
      drawFullscreen(gl);
    };
    const tex = (u: WebGLUniformLocation | null | undefined, unit: number, t: WebGLTexture) => bindTexture(gl, unit, t, u);

    // (Re)size the fields, carrying what was there across.
    const resize = (width: number, height: number) => {
      aspect = width / height;
      const short = Math.min(width, height);
      const sw = Math.round(aspect >= 1 ? SIM * aspect : SIM), sh = Math.round(aspect >= 1 ? SIM : SIM / aspect);
      const ds = Math.min(DYE, short), dw = Math.round(aspect >= 1 ? ds * aspect : ds), dh = Math.round(aspect >= 1 ? ds : ds / aspect);
      const carry = (old: Double | null, next: Double) => {
        if (!old) return next;
        run(P.copy, next.read, (u) => tex(u.uSource, 0, old.read.tex));
        free(old.read);
        free(old.write);
        return next;
      };
      velocity = carry(velocity, double(sw, sh, ...RGBA));
      dye = carry(dye, double(dw, dh, ...RGBA, true));
      if (pressure) { free(pressure.read); free(pressure.write); }
      if (divergence) free(divergence);
      if (curl) free(curl);
      pressure = double(sw, sh, ...R);
      divergence = make(sw, sh, ...R);
      curl = make(sw, sh, ...R);
      simTexel = [1 / sw, 1 / sh];
    };

    const splat = (field: Double, x: number, y: number, c: readonly [number, number, number], radius: number) => {
      run(P.splat, field.write, (u) => {
        tex(u.uTarget, 0, field.read.tex);
        gl.uniform1f(u.uAspect!, aspect);
        gl.uniform2f(u.uPoint!, x, y);
        gl.uniform3f(u.uColor!, c[0], c[1], c[2]);
        gl.uniform1f(u.uRadius!, radius);
      });
      field.swap();
    };
    const imprint = (field: Double, at: [number, number, number], amount: number, hue: number, turn: number, vel: boolean) => {
      run(P.imprint, field.write, (u) => {
        tex(u.uTarget, 0, field.read.tex);
        tex(u.uPalette, 1, palette);
        tex(u.uMark, 2, mark);
        gl.uniform1f(u.uAspect!, aspect);
        gl.uniform3f(u.uMarkAt!, at[0], at[1], at[2]);
        gl.uniform1f(u.uAmount!, amount);
        gl.uniform1f(u.uHue!, hue);
        gl.uniform1f(u.uVelocityPass!, vel ? 1 : 0);
        gl.uniform1f(u.uTurn!, turn);
      });
      field.swap();
    };

    let simTime = 0, warmed = false;
    const hand = { x: 0.5, y: 0.5, px: 0.5, py: 0.5, live: false };

    const step = (dt: number, pointer: { x: number; y: number; inside: boolean }) => {
      const v = velocity!, d = dye!, pr = pressure!;
      simTime += dt;

      // The brandmark: dye fades in over its first 0.8 s; the push comes a little after,
      // once the mark has formed, so it reads before it blooms.
      const im = imprintAt(simTime, period, aspect);
      if (im.age < 0.8) imprint(d, im.at, dt * 1.6, im.hue, im.turn, false);
      if (im.age > 1.8 && im.age < 2.6) imprint(v, im.at, dt * 30, im.hue, im.turn, true);

      // Three soft emitters drift round near the edges, each in its own brand colour.
      for (let i = 0; i < 3; i++) {
        const a = simTime * (0.11 + i * 0.03) + i * 2.1;
        const x = 0.5 + Math.cos(a) * 0.46, y = 0.5 + Math.sin(a * 1.3) * 0.44;
        const c = brand[(i * 2 + Math.floor(simTime / 9)) % brand.length]!;
        splat(d, x, y, [c[0] * dt * 0.9, c[1] * dt * 0.9, c[2] * dt * 0.9], 0.0008);
        // They swim sideways to their path, so they leave curling trails, not puffs.
        const vx = Math.cos(a * 1.7 + i) * 30, vy = Math.sin(a * 1.9 + i) * 30;
        splat(v, x, y, [vx * dt * 8, vy * dt * 8, 0], 0.002);
      }

      // The pointer stirs.
      if (interactive && pointer.inside) {
        hand.x = pointer.x;
        hand.y = pointer.y;
        if (hand.live) {
          const dx = (hand.x - hand.px) * aspect, dy = hand.y - hand.py;
          if (dx * dx + dy * dy > 1e-7) {
            splat(v, hand.x, hand.y, [dx * 2400, dy * 2400, 0], 0.0025);
            splat(d, hand.x, hand.y, [0.05, 0.035, 0.05], 0.0015);
          }
        }
        hand.px = hand.x;
        hand.py = hand.y;
        hand.live = true;
      } else hand.live = false;

      run(P.curl, curl, (u) => {
        gl.uniform2f(u.uTexel!, ...simTexel);
        tex(u.uVelocity, 0, v.read.tex);
      });
      run(P.vorticity, v.write, (u) => {
        gl.uniform2f(u.uTexel!, ...simTexel);
        tex(u.uVelocity, 0, v.read.tex);
        tex(u.uCurl, 1, curl!.tex);
        gl.uniform1f(u.uCurlStrength!, 8);
        gl.uniform1f(u.uDt!, dt);
      });
      v.swap();
      run(P.divergence, divergence, (u) => {
        gl.uniform2f(u.uTexel!, ...simTexel);
        tex(u.uVelocity, 0, v.read.tex);
      });
      run(P.scale, pr.write, (u) => {
        tex(u.uSource, 0, pr.read.tex);
        gl.uniform1f(u.uScale!, 0.8);
      });
      pr.swap();
      for (let i = 0; i < 14; i++) {
        run(P.pressure, pr.write, (u) => {
          gl.uniform2f(u.uTexel!, ...simTexel);
          tex(u.uPressure, 0, pr.read.tex);
          tex(u.uDivergence, 1, divergence!.tex);
        });
        pr.swap();
      }
      run(P.gradient, v.write, (u) => {
        gl.uniform2f(u.uTexel!, ...simTexel);
        tex(u.uPressure, 0, pr.read.tex);
        tex(u.uVelocity, 1, v.read.tex);
      });
      v.swap();
      run(P.advect, v.write, (u) => {
        gl.uniform2f(u.uSimTexel!, ...simTexel);
        tex(u.uVelocity, 0, v.read.tex);
        tex(u.uSource, 1, v.read.tex);
        gl.uniform1f(u.uDt!, dt);
        gl.uniform1f(u.uDissipation!, 0.35);
      });
      v.swap();
      run(P.advect, d.write, (u) => {
        gl.uniform2f(u.uSimTexel!, ...simTexel);
        tex(u.uVelocity, 0, v.read.tex);
        tex(u.uSource, 1, d.read.tex);
        gl.uniform1f(u.uDt!, dt);
        gl.uniform1f(u.uDissipation!, 0.32);
      });
      d.swap();
    };

    return {
      resize,
      draw({ time, dt, width, height, pointer, still }) {
        if (!velocity) resize(width, height);
        gl.disable(gl.BLEND);
        if (!warmed) {
          // Start with the first imprint formed and just beginning to bloom; a still frame
          // (reduced motion) gets the same, which is the most legible moment.
          warmed = true;
          for (let t = 0; t < WARM_UP; t += STEP) step(STEP, { x: 0, y: 0, inside: false });
        } else if (!still && dt > 0) {
          // Fixed steps, so the look doesn't depend on the frame rate (at most two a frame).
          const n = Math.min(2, Math.max(1, Math.round(dt / STEP)));
          for (let i = 0; i < n; i++) step(dt / n, pointer);
        }
        const d = dye!;
        gl.bindTexture(gl.TEXTURE_2D, d.read.tex);
        gl.generateMipmap(gl.TEXTURE_2D);
        run(P.display, null, (u) => {
          tex(u.uDye, 0, d.read.tex);
          gl.uniform2f(u.uDyeTexel!, 1 / d.read.w, 1 / d.read.h);
          gl.uniform1f(u.uTime!, time);
        }, width, height);
      },
      dispose() {
        for (const p of Object.values(P)) gl.deleteProgram(p.program);
        for (const t of [velocity?.read, velocity?.write, dye?.read, dye?.write, pressure?.read, pressure?.write, divergence, curl]) if (t) free(t);
        gl.deleteTexture(palette);
        gl.deleteTexture(mark);
      },
    };
  }, { paused, speed, quality, dpr });
  return <BackgroundFrame fallback={FALLBACK} {...frame} artRef={boxRef} ready={ready} art={<canvas ref={canvasRef} style={FILL_CANVAS} />} />;
}
