"use client";
/*
 * AsciiTransition: when `show` changes, an ASCII cover wipes in over the old
 * content, the content swaps underneath, and the cover wipes away. The wipe is a
 * shaders/react transition run as ASCII; its progress is driven from here. Every
 * wipe takes progress as the share of its content wiped away (0 is a full cover);
 * invert flips the shape, not the direction. So in runs inverted from 1 down to 0,
 * closing over the old content, and out runs from 0 up to 1, opening on the new.
 * Without WebGPU the content crossfades; with reduced motion it swaps.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useReducedMotion, type LookProps } from "ascii-magic-art-react";
import { Shader, LinearGradient, IrisWipe, BlockDissolve, RippleWipe, VenetianBlinds } from "shaders/react";
import { ShaderStage } from "../../shader/ShaderStage.js";

export type AsciiTransitionEffect = "iris" | "dissolve" | "ripple" | "blinds";
export const ASCII_TRANSITION_EFFECTS: readonly AsciiTransitionEffect[] = ["iris", "dissolve", "ripple", "blinds"];

const WIPES = { iris: IrisWipe, dissolve: BlockDissolve, ripple: RippleWipe, blinds: VenetianBlinds };

export interface AsciiTransitionProps extends LookProps {
  /** Which content is showing. Change it to play the transition; the children at that moment are what it reveals. */
  show: string | number;
  /** The wipe. Default iris. */
  effect?: AsciiTransitionEffect;
  /** The whole transition, in and out, in ms. Default 1000. */
  duration?: number;
  /** The cover's gradient. Default #7c3aed to #38bdf8. */
  colorA?: string;
  colorB?: string;
  /** Width of the cover in cells. Default 64. */
  cols?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

type Phase = "idle" | "in" | "out";
const ease = (x: number) => x * x * (3 - 2 * x);

export function AsciiTransition({
  show, effect = "iris", duration = 1000, colorA = "#7c3aed", colorB = "#38bdf8", cols = 64, className, style, children, ...look
}: AsciiTransitionProps) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(show);
  const [phase, setPhase] = useState<Phase>("idle");
  const [p, setP] = useState(1);
  const [failed, setFailed] = useState(false);
  // The old content, held on screen while the cover comes in.
  const held = useRef<ReactNode>(children);
  if (phase === "idle" && show === shown) held.current = children;

  useEffect(() => {
    if (show === shown) return;
    if (reduced) { setShown(show); return; }
    const half = duration / 2, start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = now - start;
      if (e < half) { setPhase("in"); setP(ease(e / half)); }
      else if (e < duration) { setShown(show); setPhase("out"); setP(ease((e - half) / half)); }
      else { setShown(show); setPhase("idle"); setP(1); return; }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [show]); // eslint-disable-line react-hooks/exhaustive-deps

  const Wipe = WIPES[effect];
  // Without WebGPU the content itself fades out and back in.
  const fade = failed && phase !== "idle" ? (phase === "in" ? 1 - p : p) : 1;
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      <div style={{ opacity: fade, height: "100%" }}>{phase === "in" ? held.current : children}</div>
      <ShaderStage
        cols={cols} {...look}
        style={{ position: "absolute", inset: 0, minHeight: 0, pointerEvents: "none", zIndex: 2 }}
        onUnavailable={() => setFailed(true)}
        scene={
          <Shader>
            <Wipe progress={phase === "in" ? 1 - p : p} invert={phase === "in"}>
              <LinearGradient colorA={colorA} colorB={colorB} angle={45} />
            </Wipe>
          </Shader>
        }
      />
    </div>
  );
}
