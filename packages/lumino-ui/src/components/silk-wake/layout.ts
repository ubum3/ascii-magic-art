// Where SilkWake's hidden mark sits, as pure numbers (tested in test/bg-36.test.mjs).

/**
 * The mark's placement for a box of this aspect: [centre x, centre y, square side]
 * in shader units (x 0 to aspect, y 0 to 1, y up). Wide boxes put it big on the
 * right, the rest low in the middle, clear of a centred card. It switches rather than
 * blends: halfway between the two, it would sit on the card.
 */
export function silkLayout(aspect: number): [number, number, number] {
  if (aspect >= 1.25) return [aspect - 0.36, 0.5, Math.min(0.9, aspect * 0.58)];
  return [aspect * 0.5, 0.17, Math.min(aspect * 1.1, 0.62)];
}
