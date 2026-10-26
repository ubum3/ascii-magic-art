// Where LuminoOrb puts the glass orb, kept pure so it can be tested without a GPU.

/** The orb in shader space (x 0 to aspect, y 0 to 1, y up): its centre and radius. */
export interface OrbPlace {
  x: number;
  y: number;
  r: number;
}

/** Half the sign-in card's width (380 px plus a margin) in box-height units, for a typical 900 px tall desktop box. */
const CARD_HALF = 0.23;

/**
 * Wide boxes get the orb centred in the space right of a centred card, a touch
 * above the middle. Narrow ones (phones, portrait tablets) get it in the upper
 * area above the card, right of centre and a little cut off by the top edge.
 */
export function orbPlace(aspect: number): OrbPlace {
  const a = Math.max(0.2, aspect);
  const free = a * 0.5 - CARD_HALF;
  if (free >= 0.36) {
    const r = Math.min(0.3, free * 0.42);
    return { x: a * 0.5 + CARD_HALF + free * 0.5, y: 0.55, r };
  }
  const r = Math.min(0.2, Math.max(0.12, a * 0.36));
  return { x: a * 0.64, y: 1 - r * 0.8, r };
}
