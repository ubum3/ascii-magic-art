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
];

/** The entry with this id, if there is one. */
export function findBackground(id: string): BackgroundEntry | undefined {
  return LUMINO_BACKGROUNDS.find((b) => b.id === id);
}
