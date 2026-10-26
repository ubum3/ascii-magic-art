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
