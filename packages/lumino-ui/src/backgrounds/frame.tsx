// What every Lumino background shares: its props, and the frame that holds the art, the fallback and your content.
import type { CSSProperties, HTMLAttributes, ReactNode, Ref } from "react";
import { LUMINO_COLORS } from "../brand/brand.js";

/** The props every Lumino background takes, on top of its own. */
export interface LuminoBackgroundProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Your content (a sign-in card, a hero), drawn on top and filling the box. */
  children?: ReactNode;
  /** Freezes the animation. Default false. */
  paused?: boolean;
  /** Animation speed. Default 1. */
  speed?: number;
  /** Darkens the middle of the box so content there stays readable: 0 (none) to 1. Default 0. */
  dim?: number;
  /** Render resolution, 0.25 to 1, as a share of the box's device pixels. Each background picks its own default. */
  quality?: number;
  /** Highest device pixel ratio to render at. Default 1.5. */
  dpr?: number;
}

/** A Lumino background component: fills its container, takes LuminoBackgroundProps. */
export type LuminoBackground<P = object> = (props: LuminoBackgroundProps & P) => ReactNode;

/** A soft, static brand glow on the ground colour: the server HTML and the look without WebGL. */
export const BRAND_FALLBACK = [
  `radial-gradient(55% 60% at 88% 92%, ${LUMINO_COLORS.coral}55, transparent 70%)`,
  `radial-gradient(45% 50% at 72% 100%, ${LUMINO_COLORS.peach}40, transparent 70%)`,
  `radial-gradient(60% 55% at 8% 6%, ${LUMINO_COLORS.blue}50, transparent 70%)`,
  `radial-gradient(50% 50% at 0% 40%, ${LUMINO_COLORS.plum}60, transparent 70%)`,
  LUMINO_COLORS.ground,
].join(", ");

const BOX: CSSProperties = { position: "relative", width: "100%", height: "100%", overflow: "hidden", isolation: "isolate" };
const LAYER: CSSProperties = { position: "absolute", inset: 0, pointerEvents: "none" };
const CONTENT: CSSProperties = { position: "relative", zIndex: 1, width: "100%", height: "100%" };

export interface BackgroundFrameProps extends Omit<LuminoBackgroundProps, "paused" | "speed" | "quality" | "dpr"> {
  /** The art: a canvas, SVG or other layers. It is aria-hidden and fades in once `ready`. */
  art: ReactNode;
  /** True once the art has drawn its first frame. Until then (and on the server) the fallback shows. */
  ready: boolean;
  /** CSS background shown until the art is ready, or for good without WebGL. Default BRAND_FALLBACK. */
  fallback?: string;
  /** Fade-in time for the art, in ms. Default 900. */
  fadeIn?: number;
  /** A ref to the layer holding the art (it covers the whole box): pass the loop's `boxRef`. */
  artRef?: Ref<HTMLDivElement>;
}

/**
 * The box a background draws in. It fills its container (give the container a
 * size), shows `fallback` until the art is ready, then fades the art in over
 * it, dims the middle by `dim`, and puts `children` on top.
 */
export function BackgroundFrame({ art, artRef, ready, fallback = BRAND_FALLBACK, fadeIn = 900, dim = 0, children, style, ...rest }: BackgroundFrameProps) {
  const ground = LUMINO_COLORS.ground;
  return (
    <div data-lumino-bg="" {...rest} style={{ ...BOX, background: fallback, ...style }}>
      <div ref={artRef} aria-hidden="true" style={{ ...LAYER, opacity: ready ? 1 : 0, transition: `opacity ${fadeIn}ms ease` }}>{art}</div>
      {dim > 0 && (
        <div
          aria-hidden="true"
          style={{
            ...LAYER,
            background: `radial-gradient(ellipse 55% 50% at 50% 50%, ${ground}${alpha(dim)}, ${ground}${alpha(dim * 0.55)} 55%, transparent 85%)`,
          }}
        />
      )}
      {children != null && <div style={CONTENT}>{children}</div>}
    </div>
  );
}

/** 0 to 1 as two hex digits, for #rrggbbaa. */
function alpha(a: number) {
  return Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, "0");
}

/** Styles for a canvas that fills the frame. */
export const FILL_CANVAS: CSSProperties = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" };
