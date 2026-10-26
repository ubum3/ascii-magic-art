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
];

/** The entry with this id, if there is one. */
export function findBackground(id: string): BackgroundEntry | undefined {
  return LUMINO_BACKGROUNDS.find((b) => b.id === id);
}
