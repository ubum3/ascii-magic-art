"use client";
import type { ComponentProps } from "react";
import { AsciiPlayer } from "ascii-magic-art-react";
import { luminoDonut } from "./piece.js";

export type LuminoDonutProps = Omit<ComponentProps<typeof AsciiPlayer>, "piece">;

/** The Lumino brandmark as a glassy spinning solid. Takes every AsciiPlayer prop (size, speed, paused, bg, look, ...). */
export function LuminoDonut({ size = 10, label = "The Lumino brandmark, spinning", ...props }: LuminoDonutProps) {
  return <AsciiPlayer piece={luminoDonut} size={size} label={label} {...props} />;
}
