// Where LuminoChrome puts the mark, kept pure so it can be tested without a GPU.

/** The mark's square in shader space (x 0 to aspect, y 0 to 1, y up): its centre and side. */
export interface ChromeMarkPlace {
  x: number;
  y: number;
  size: number;
}

/**
 * Wide boxes get the mark low on the right, beside a centred card; tall ones
 * (phones) get it across the bottom, under the card.
 */
export function chromeMarkPlace(aspect: number): ChromeMarkPlace {
  if (aspect >= 1) {
    const size = Math.min(0.85, 0.36 * aspect);
    return { x: aspect - size * 0.44, y: size * 0.42, size };
  }
  const size = Math.max(0.36, aspect);
  return { x: aspect * 0.5, y: size * 0.36, size };
}

/** The sign-in card's half size in shader units (box height 1), for a box `cssWidth` x `cssHeight`: about 400 x 460 px, never wider than the box. */
export function cardHalfSize(cssWidth: number, cssHeight: number): [number, number] {
  return [Math.min(200, cssWidth / 2) / cssHeight, Math.min(230, cssHeight / 2) / cssHeight];
}
