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
