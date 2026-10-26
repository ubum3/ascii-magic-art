// Every Lumino background, loaded lazily: importing this list loads none of them.
import type { ComponentType } from "react";
import type { LuminoBackgroundProps } from "./frame.js";

export interface BackgroundEntry {
  /** Its entry and folder name: lumino-ui/<id>. */
  id: string;
  name: string;
  /** One line on the look. */
  description: string;
  /** Who made it (the session that built it). */
  author: string;
  tags: readonly string[];
  /** Loads the component, with its own defaults. */
  load: () => Promise<ComponentType<LuminoBackgroundProps>>;
}

export const LUMINO_BACKGROUNDS: readonly BackgroundEntry[] = [
  {
    id: "lumino-aura",
    name: "Lumino Aura",
    description: "Aurora curtains in the brand gradient, with the brandmark as a rim of glass light low on the right.",
    author: "cd",
    tags: ["webgl", "aurora", "glass"],
    load: () => import("../components/lumino-aura/index.js").then((m) => m.LuminoAura),
  },
  {
    id: "lumino-glyphs",
    name: "Lumino Glyphs",
    description: "The portal's GradientASCII: a flowing brand gradient drawn as glyphs, with the brandmark as the most common glyph and amounts typed over it.",
    author: "cd",
    tags: ["webgl", "ascii", "gradient"],
    load: () => import("../components/lumino-glyphs/index.js").then((m) => m.LuminoGlyphs),
  },
  {
    id: "dither-lens",
    name: "Dither Lens",
    description: "A chunky dithered aurora in the brand gradient, seen smooth and glowing through a big frosted-glass brandmark lens.",
    author: "cd",
    tags: ["webgl", "dither", "glass"],
    load: () => import("../components/dither-lens/index.js").then((m) => m.DitherLens),
  },
  {
    id: "signal-rain",
    name: "Signal Rain",
    description: "Dim falling digits that ignite into warm light as they pass through a large brandmark, so the rain draws the mark.",
    author: "cd",
    tags: ["webgl", "ascii", "glow"],
    load: () => import("../components/signal-rain/index.js").then((m) => m.SignalRain),
  },
  {
    id: "halftone-tide",
    name: "Halftone Tide",
    description: "A lumino.io-style dot grid swelling under slow tides of brand light, with the brandmark surfacing in larger, brighter dots.",
    author: "cd",
    tags: ["webgl", "dots", "halftone"],
    load: () => import("../components/halftone-tide/index.js").then((m) => m.HalftoneTide),
  },
  {
    id: "edge-orbit",
    name: "Edge Orbit",
    description: "ASCII halftone: the night Earth from low orbit, requests arcing between cities, a white brandmark star in the sky.",
    author: "cd",
    tags: ["ascii", "orbit", "halftone"],
    load: () => import("./adapters.js").then((m) => m.EdgeOrbitBackground),
  },
  {
    id: "lumino-space",
    name: "Lumino Space",
    description: "ASCII deep space: a nebula, twinkling dust and brandmark stars drifting by in parallax.",
    author: "cd",
    tags: ["ascii", "space"],
    load: () => import("./adapters.js").then((m) => m.LuminoSpaceBackground),
  },
];

/** The entry with this id, if there is one. */
export function findBackground(id: string): BackgroundEntry | undefined {
  return LUMINO_BACKGROUNDS.find((b) => b.id === id);
}
