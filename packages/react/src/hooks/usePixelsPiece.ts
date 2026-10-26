"use client";
/*
 * usePixelsPiece: anything you can draw into a 2D canvas, as a live piece. Every
 * animation frame the source is drawn into a small canvas, one pixel per cell, and
 * turned into cells by ascii-magic-art-extras (cellsFromPixels), with the palette
 * rebuilt now and then so it follows the picture. AsciiWebcam and AsciiShader use it.
 */
import { useEffect, useState } from "react";
import type { Frame, PieceModule } from "ascii-magic-art/lib/types.js";
import { cellsFromPixels, buildPalette, cellsFrame } from "ascii-magic-art-extras";

export interface PixelSource {
  /** Grid size in cells, which is also the size of the canvas drawn into. */
  cols: number;
  rows: number;
  /**
   * Draw the source into ctx, scaled to w x h. Return false when there is nothing
   * to draw yet (no video frame, no canvas); the last frame stays up.
   */
  draw(ctx: CanvasRenderingContext2D, w: number, h: number): boolean | void;
}

export interface PixelsOptions {
  /** Square pixel cells (sharper colour) or text cells (for looks). Default true. */
  square?: boolean;
  /** Palette size. Default 32. */
  colors?: number;
  /** A colour the picture is composited over, for sources with transparency. Default none: transparent is empty. */
  bg?: string;
  /** For the piece's meta: slug prefix and name. */
  slug?: string;
  name?: string;
  fps?: number;
}

/**
 * A piece that plays `source`, or undefined until the first frame has been read.
 * Pass undefined while the source is getting ready. A read that comes back fully
 * transparent (a GPU canvas between presented frames) keeps the previous frame.
 */
export function usePixelsPiece(source: PixelSource | undefined, { square = true, colors = 32, bg, slug = "pixels", name = "Pixels", fps = 30 }: PixelsOptions = {}): PieceModule | undefined {
  const [piece, setPiece] = useState<PieceModule>();
  useEffect(() => {
    setPiece(undefined);
    if (!source) return;
    const { cols: w, rows: h } = source;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;
    const under = bg && /^#[0-9a-f]{6}$/i.test(bg) ? [1, 3, 5].map((i) => parseInt(bg.slice(i, i + 2), 16)) : null;
    let latest: Frame = "", palette: string[] | undefined, keyed: Record<string, string> = {}, n = 0, raf = 0, made = false;
    const grab = () => {
      raf = requestAnimationFrame(grab);
      ctx.clearRect(0, 0, w, h);
      if (source.draw(ctx, w, h) === false) return;
      const px = ctx.getImageData(0, 0, w, h).data;
      let seen = false;
      for (let i = 3; i < px.length; i += 4) if (px[i]) { seen = true; break; }
      if (!seen) return;
      if (under) for (let i = 0; i < px.length; i += 4) {
        const a = px[i + 3] / 255;
        for (let c = 0; c < 3; c++) px[i + c] = px[i + c] * a + under[c] * (1 - a);
        px[i + 3] = 255;
      }
      if (!palette || n++ % 45 === 0) palette = buildPalette([px], colors); // follow the light, now and then
      const cells = cellsFromPixels(px, w, h, { palette });
      keyed = cells.palette;
      latest = { ...cellsFrame(cells), palette: cells.palette } as Frame;
      if (!made) {
        made = true;
        const meta = {
          slug: `${slug}-${w}x${h}`, name, category: "extras", note: "", tags: ["extras", slug],
          cols: w, rows: h, fps, palette: keyed,
          ...(square ? { cell: "square" as const } : {}),
        };
        setPiece(Object.freeze({ meta, default: () => () => latest }));
      }
    };
    grab();
    return () => cancelAnimationFrame(raf);
  }, [source, square, colors, bg, slug, name, fps]);
  return piece;
}
