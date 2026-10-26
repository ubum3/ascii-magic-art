// The Lumino brand for the backgrounds: colours from lumino.io and the brandmark as vector paths.

/** The brand gradient's stops, warm to cool, and the near-black ground the site sits on. */
export const LUMINO_COLORS = {
  ground: "#111013",
  peach: "#F8AD90",
  coral: "#EF5C47",
  wine: "#74314B",
  plum: "#482A4B",
  indigo: "#302A50",
  blue: "#4B5BA1",
  lavender: "#A4A5D1",
} as const;

/** The seven gradient stops in order, with their positions (0 to 1) on lumino.io's 139deg gradient. */
export const LUMINO_STOPS: readonly (readonly [string, number])[] = [
  [LUMINO_COLORS.peach, 0.0494],
  [LUMINO_COLORS.coral, 0.3131],
  [LUMINO_COLORS.wine, 0.381],
  [LUMINO_COLORS.plum, 0.4969],
  [LUMINO_COLORS.indigo, 0.6447],
  [LUMINO_COLORS.blue, 0.8046],
  [LUMINO_COLORS.lavender, 0.8805],
];

/** Just the seven colours, warm to cool: a palette for components that take a list. */
export const LUMINO_PALETTE: readonly string[] = LUMINO_STOPS.map(([c]) => c);

/** lumino.io's brand gradient as CSS. */
export const LUMINO_GRADIENT = `linear-gradient(139.22deg, ${LUMINO_STOPS.map(([c, p]) => `${c} ${(p * 100).toFixed(2)}%`).join(", ")})`;

/** A filled vector shape: SVG `d` strings over a viewBox, fill-only. */
export interface VectorMark {
  viewBox: readonly [number, number];
  /** The tight box around the paths inside the viewBox: x, y, width, height. */
  bounds: readonly [number, number, number, number];
  paths: readonly string[];
}

/**
 * The Lumino brandmark: two tall blades meeting at a point over a curved base.
 * The geometry of "Brandmark Lumino Black.svg" (from lumino-services
 * packages/ui/src/icons/lumino-brandmark.ts); the fill is the caller's.
 * paths[0] is the base, paths[1] the right blade, paths[2] the left blade.
 */
export const BRANDMARK: VectorMark = {
  viewBox: [2000, 2000],
  bounds: [359.72, 444.98, 1280.67, 1111.36],
  paths: [
    "M1595.53,1511.42c-9.53,15.38-19.64,30.37-30.29,44.92l-2.15-.94-372.59-162.85h-381l-374.74,163.79c-10.65-14.55-20.76-29.54-30.29-44.92l.24-.14,388.73-224.43h413.12l388.73,224.43.24.14Z",
    "M1638.4,1424.96l-336.18-247.78-180.42-312.48-46.49-415.04-.26-2.34c-17.83-1.9-35.85-3.13-54.05-3.67v449.05l206.57,357.77,388.73,224.44.26.15c8.55-15.85,16.5-32.07,23.83-48.63l-1.99-1.47Z",
    "M924.95,447.32l-.26,2.34-46.49,415.04-180.41,312.48-338.18,249.24c7.33,16.56,15.28,32.78,23.83,48.63l.26-.15,388.73-224.44,206.57-357.77v-449.05c-18.2.54-36.22,1.77-54.05,3.67Z",
  ],
};
