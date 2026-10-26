"use client";
import type { ComponentProps } from "react";
import { AsciiHero } from "ascii-magic-art-react";
import { luminoSpace } from "./piece.js";

export type LuminoSpaceProps = Omit<ComponentProps<typeof AsciiHero>, "piece">;

/** Deep space with Lumino brandmarks for stars, filling its container behind your content. Takes every AsciiHero prop (fit, dim, opacity, speed, look, ...). */
export function LuminoSpace({ bg = "#05060f", ...props }: LuminoSpaceProps) {
  return <AsciiHero piece={luminoSpace} bg={bg} {...props} />;
}
