// Where the globe and the rising mark sit for a box's aspect ratio (units of the box's height, y up).

export interface GlobeLayout {
  /** The globe's centre and radius. */
  globe: [number, number, number];
  /** The risen mark's centre and side. */
  sun: [number, number, number];
}

/**
 * Wide boxes put the globe low on the left with the mark rising off its limb to
 * the right of the middle; tall boxes put the globe along the bottom with the
 * mark rising just right of centre, under where a card sits.
 */
export function globeLayout(aspect: number, size = 1): GlobeLayout {
  const wide = Math.max(0, Math.min(1, (aspect - 0.6) / 0.9));
  const cx = aspect * (0.5 - 0.22 * wide);
  const R = 0.95 + 0.25 * wide;
  const cy = -R + 0.17 + 0.15 * wide;
  // The limb point the mark rises from, as an angle from straight up, towards the right.
  const theta = 0.12 + 0.46 * wide;
  const side = (0.42 + 0.08 * wide) * size;
  const reach = R + side * 0.24;
  return {
    globe: [cx, cy, R],
    sun: [cx + Math.sin(theta) * reach, cy + Math.cos(theta) * reach, side],
  };
}

/** The rise: `from` (already part way up, so the first frame shows the mark) eased to 1 over `duration` seconds. */
export function riseAt(time: number, duration = 3, from = 0.55): number {
  const t = Math.max(0, Math.min(1, time / duration));
  return from + (1 - from) * (1 - Math.pow(1 - t, 3));
}
