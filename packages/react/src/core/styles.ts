import type { CSSProperties } from "react";
import { CELL_W, FONT } from "ascii-magic-art/runtime/canvas.js";

/*
 * The player sizes its canvas in px with max-width:100%. Letting the height follow
 * the canvas's own aspect ratio keeps it from squashing in a narrow column.
 * Heroes scale the art past the container on purpose, so they lift the max-width.
 */
export const CSS =
  "[data-ama] canvas{height:auto!important}" +
  "[data-ama-hero] canvas{max-width:none!important}";

export const wrapperStyle = (fontSize: number | string, bg?: string): CSSProperties => ({
  display: "inline-block",
  maxWidth: "100%",
  overflow: "hidden",
  verticalAlign: "top",
  font: `${typeof fontSize === "number" ? fontSize + "px" : fontSize}/1 ${FONT}`,
  background: bg,
});

/** Typography comes from the wrapper; display and line-height are left to the player. */
export const preStyle = (square: boolean, box?: { width: string; height: string }): CSSProperties => ({
  margin: 0,
  font: "inherit",
  whiteSpace: "pre",
  letterSpacing: 0,
  ...(square ? { lineHeight: String(CELL_W) } : null),
  ...box,
});
