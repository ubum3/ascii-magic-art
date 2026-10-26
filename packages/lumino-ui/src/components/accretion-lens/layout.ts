// Where the black hole sits for a box's aspect ratio (units of the box's height, y up).

/**
 * The mark's centre and side: high on the right of wide boxes, across the top of
 * tall ones, out of the way of a centred card.
 */
export function holeLayout(aspect: number, size = 1): [number, number, number] {
  const wide = Math.max(0, Math.min(1, (aspect - 0.6) / 0.9));
  const side = (0.27 + 0.25 * wide) * size;
  const x = aspect * (0.5 + 0.27 * wide);
  const y = 0.82 - 0.14 * wide * wide;
  return [x, y, side];
}
