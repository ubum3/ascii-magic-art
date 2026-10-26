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
    id: "glass-prism-rays",
    name: "Glass Prism Rays",
    description: "The brandmark as a glass prism lit from behind, throwing prismatic light shafts down the sides.",
    author: "dd",
    tags: ["webgl", "rays", "glass", "light"],
    load: () => import("../components/glass-prism-rays/index.js").then((m) => m.GlassPrismRays),
  },
  {
    id: "apex-burst",
    name: "Apex Burst",
    description: "A prismatic light burst from the brandmark's heart, cut into rays by its blades and base.",
    author: "dd",
    tags: ["webgl", "burst", "rays", "light"],
    load: () => import("../components/apex-burst/index.js").then((m) => m.ApexBurst),
  },
  {
    id: "arc-conduit",
    name: "Arc Conduit",
    description: "Electric arcs crawl the outline of a big glass brandmark and jump its gaps, shedding ASCII glyphs.",
    author: "dd",
    tags: ["canvas", "lightning", "energy", "ascii"],
    load: () => import("../components/arc-conduit/index.js").then((m) => m.ArcConduit),
  },
  {
    id: "pillar-stage",
    name: "Pillar Stage",
    description: "The brandmark as the stage: two leaning light pillars meet in a star over the content, above a horizon arc.",
    author: "dd",
    tags: ["webgl", "pillars", "light"],
    load: () => import("../components/pillar-stage/index.js").then((m) => m.PillarStage),
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
  {
    id: "ferro-bloom",
    name: "Ferro Bloom",
    description: "Glossy black ferrofluid spiking up along the brandmark, its magnet, with the brand gradient on the slopes.",
    author: "36",
    tags: ["webgl", "fluid", "glass", "interactive"],
    load: () => import("../components/ferro-bloom/index.js").then((m) => m.FerroBloom),
  },
  {
    id: "field-lines",
    name: "Field Lines",
    description: "The brandmark as a magnet: glowing field lines bridge its strokes and loop into the dark, with pulses of light running along them.",
    author: "36",
    tags: ["webgl", "lines", "field", "interactive"],
    load: () => import("../components/field-lines/index.js").then((m) => m.FieldLines),
  },
  {
    id: "silk-wake",
    name: "Silk Wake",
    description: "Translucent silk ribbons drift at 139deg and part around an invisible brandmark, which shows as the gap they leave and a rim of light.",
    author: "36",
    tags: ["webgl", "silk", "flow", "interactive"],
    load: () => import("../components/silk-wake/index.js").then((m) => m.SilkWake),
  },
  {
    id: "ether-imprint",
    name: "Ether Imprint",
    description: "Warm nebula dye in a live fluid; every few seconds the brandmark is stamped into it, blooms, curls apart and dissolves.",
    author: "36",
    tags: ["webgl", "fluid", "nebula", "interactive"],
    load: () => import("../components/ether-imprint/index.js").then((m) => m.EtherImprint),
  },
  {
    id: "lumino-chrome",
    name: "Lumino Chrome",
    description: "A liquid-chrome sea reflecting the brand gradient, with the brandmark rising out of the metal as a bevelled relief.",
    author: "b3",
    tags: ["webgl", "chrome", "glass", "liquid"],
    load: () => import("../components/lumino-chrome/index.js").then((m) => m.LuminoChrome),
  },
  {
    id: "lumino-orb",
    name: "Lumino Orb",
    description: "A glass orb off to one side, with the brandmark caught inside as a slowly turning refracted caustic and an iridescent thin-film rim.",
    author: "b3",
    tags: ["webgl", "glass", "orb", "iridescent"],
    load: () => import("../components/lumino-orb/index.js").then((m) => m.LuminoOrb),
  },
  {
    id: "lumino-frost",
    name: "Lumino Frost",
    description: "Three frosted-glass slabs cut to the brandmark's three shapes, drifting in parallax over warm nebula light.",
    author: "b3",
    tags: ["css", "glass", "frosted", "canvas"],
    load: () => import("../components/lumino-frost/index.js").then((m) => m.LuminoFrost),
  },
  {
    id: "lumino-shards",
    name: "Lumino Shards",
    description: "The brandmark shattered into glass shards that orbit the card and pull back together into the mark every few seconds.",
    author: "b3",
    tags: ["webgl", "glass", "shards", "particles"],
    load: () => import("../components/lumino-shards/index.js").then((m) => m.LuminoShards),
  },
];

/** The entry with this id, if there is one. */
export function findBackground(id: string): BackgroundEntry | undefined {
  return LUMINO_BACKGROUNDS.find((b) => b.id === id);
}
