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
  {
    id: "globe-dawn",
    name: "Globe Dawn",
    description: "The lumino.io dotted globe low on the screen, with the brandmark rising behind its limb like a sun.",
    author: "97",
    tags: ["webgl", "globe", "dots", "cosmic"],
    load: () => import("../components/globe-dawn/index.js").then((m) => m.GlobeDawn),
  },
  {
    id: "accretion-lens",
    name: "Accretion Lens",
    description: "The brandmark as a black hole: a photon ring on its outline, an accretion disk, and space lensed to its shape.",
    author: "97",
    tags: ["webgl", "black-hole", "lensing", "cosmic"],
    load: () => import("../components/accretion-lens/index.js").then((m) => m.AccretionLens),
  },
  {
    id: "brandmark-galaxy",
    name: "Brandmark Galaxy",
    description: "A tilted spiral galaxy whose nucleus is the brandmark in stars, its arms unwinding from it.",
    author: "97",
    tags: ["webgl", "particles", "galaxy", "cosmic"],
    load: () => import("../components/brandmark-galaxy/index.js").then((m) => m.BrandmarkGalaxy),
  },
  {
    id: "nebula-constellation",
    name: "Nebula Constellation",
    description: "Warm nebula clouds where stars drift together and draw the brandmark in glowing glass lines, then dissolve and re-form.",
    author: "97",
    tags: ["webgl", "nebula", "constellation", "cosmic"],
    load: () => import("../components/nebula-constellation/index.js").then((m) => m.NebulaConstellation),
  },
];

/** The entry with this id, if there is one. */
export function findBackground(id: string): BackgroundEntry | undefined {
  return LUMINO_BACKGROUNDS.find((b) => b.id === id);
}
