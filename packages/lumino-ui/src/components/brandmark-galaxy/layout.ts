// Where the galaxy sits for a box's aspect ratio (units of the box's height, y up).

export interface GalaxyLayout {
  /** The centre and the disk's radius. */
  galaxy: [number, number, number];
  /** The cosine of the disk's tilt and its major axis's angle (radians). */
  shape: [number, number];
  /** The mark's side at the centre. */
  markSide: number;
}

/**
 * Wide boxes put the galaxy low on the left, cropped by the edges, its arms
 * reaching across; tall boxes put it along the bottom, under a card.
 */
export function galaxyLayout(aspect: number, size = 1): GalaxyLayout {
  const wide = Math.max(0, Math.min(1, (aspect - 0.6) / 0.9));
  const x = aspect * (0.5 - 0.3 * wide);
  const y = 0.15 + 0.15 * wide;
  const radius = (0.62 + 0.45 * wide) * size;
  return {
    galaxy: [x, y, radius],
    shape: [0.42 + 0.08 * wide, 0.32 * wide - 0.08],
    markSide: (0.22 + 0.06 * wide) * size,
  };
}
