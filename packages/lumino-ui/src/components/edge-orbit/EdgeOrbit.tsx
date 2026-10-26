"use client";
import type { ComponentProps } from "react";
import { AsciiHero } from "ascii-magic-art-react";
import { edgeOrbit } from "./piece.js";

export type EdgeOrbitProps = Omit<ComponentProps<typeof AsciiHero>, "piece">;

/** The night Earth from orbit with requests arcing city to city, filling its container behind your content. Takes every AsciiHero prop (fit, dim, opacity, speed, look, ...). */
export function EdgeOrbit({ bg = "#04060c", ...props }: EdgeOrbitProps) {
  return <AsciiHero piece={edgeOrbit} bg={bg} {...props} />;
}
