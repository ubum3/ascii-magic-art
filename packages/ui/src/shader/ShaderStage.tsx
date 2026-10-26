"use client";
/*
 * ShaderStage: a WebGPU scene (a <Shader> tree from shaders/react) played as ASCII
 * art that fills its container behind your content, like AsciiHero. The grid is
 * sized to the box, so nothing is cropped. Where there is no WebGPU it plays a clip
 * baked from the same scene (scripts/bake.mjs), fetched only then.
 *
 * The shader reads the cursor from the window, so content on top doesn't stop it
 * from following the pointer.
 */
import { useEffect, useRef, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { AsciiHero, type LookProps, type PieceModule, type PlaybackOptions } from "ascii-magic-art-react";
import { loadClip } from "ascii-magic-art-react/extras";
import { AsciiShader } from "ascii-magic-art-react/shader";

/** A cell's width over its font size (runtime/canvas.js CELL_W). */
const CELL_W = 0.602;

/** A baked clip module: `export const CLIP = "<base64 .amc>"`, loaded with a dynamic import. */
export type ClipLoader = () => Promise<{ CLIP: string }>;

export interface ShaderStageProps extends LookProps, PlaybackOptions {
  /** Width in cells; the height follows the box. Default 96. */
  cols?: number;
  /** Palette size of the live shader. Default 32. */
  colors?: number;
  /** cover fills the box with the baked clip (cropping); contain shows all of it. Default cover. */
  fit?: "cover" | "contain";
  /** Opacity of the art, 0 to 1. Default 1. */
  opacity?: number;
  /** Darken the art under your content: 0 (none) to 1 (black). Default 0. */
  dim?: number;
  /** Background colour of the whole stage. */
  bg?: string;
  /** Skip WebGPU and play the baked clip, as a browser without it would. */
  baked?: boolean;
  /** Called once if WebGPU is unavailable, with the reason. */
  onUnavailable?: (reason: unknown) => void;
  /** Accessible name for the art. It is decoration by default. */
  label?: string;
  /** The stage needs a height: give it one with className or style. Default min-height 24rem. */
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

interface StageProps extends ShaderStageProps {
  /** The scene: one <Shader> element. */
  scene: ReactElement;
  /** Its baked clip, for browsers without WebGPU. */
  clip?: ClipLoader;
}

/** Decode a base64 .amc clip into a piece. */
async function clipPiece(load: ClipLoader): Promise<PieceModule> {
  const { CLIP } = await load();
  return loadClip(Uint8Array.from(atob(CLIP), (c) => c.charCodeAt(0)));
}

/** The baked clip, filling the stage. Fetched when this mounts. */
function Baked({ clip, fit, bg, ...rest }: { clip?: ClipLoader } & Pick<StageProps, "fit" | "bg" | "label"> & LookProps & PlaybackOptions) {
  const [piece, setPiece] = useState<PieceModule>();
  useEffect(() => {
    let cancelled = false;
    clip && clipPiece(clip).then((p) => { if (!cancelled) setPiece(p); }, () => {});
    return () => { cancelled = true; };
  }, [clip]);
  if (!piece) return null;
  return <AsciiHero piece={piece} fit={fit} bg={bg} ssr={false} style={{ position: "absolute", inset: 0, minHeight: 0 }} {...rest} />;
}

export function ShaderStage({
  scene, clip, cols = 96, colors = 32, fit = "cover", opacity = 1, dim = 0, bg, baked = false, onUnavailable, label,
  className, style, children, ...rest
}: StageProps) {
  const root = useRef<HTMLDivElement>(null);
  const [rows, setRows] = useState(Math.round((cols * 9) / 16));
  const [failed, setFailed] = useState(false);

  // Rows follow the box's shape (square cells), settled after a resize.
  useEffect(() => {
    const el = root.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fit = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width > 0 && height > 0) setRows(Math.max(4, Math.round((cols * height) / width)));
    };
    fit();
    const ro = new ResizeObserver(() => { clearTimeout(timer); timer = setTimeout(fit, 150); });
    ro.observe(el);
    return () => { ro.disconnect(); clearTimeout(timer); };
  }, [cols]);

  const fallback = baked || failed
    ? <Baked clip={clip} fit={fit} bg={bg} label={label} {...rest} />
    : null;

  return (
    <div
      ref={root}
      className={className}
      style={{ position: "relative", overflow: "hidden", containerType: "size", minHeight: "24rem", background: bg, ...style }}
    >
      <div aria-hidden={label ? undefined : true} style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity }}>
        {baked ? fallback : (
          <AsciiShader
            cols={cols} rows={rows} colors={colors} bg={bg} label={label}
            size={`calc(100cqw / ${+(cols * CELL_W).toFixed(4)})`}
            fallback={fallback}
            onUnavailable={(reason) => { setFailed(true); onUnavailable?.(reason); }}
            {...rest}
          >
            {scene}
          </AsciiShader>
        )}
      </div>
      {dim > 0 && <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: `rgba(0,0,0,${Math.min(1, dim)})`, pointerEvents: "none" }} />}
      <div style={{ position: "relative", zIndex: 1, height: "100%" }}>{children}</div>
    </div>
  );
}
