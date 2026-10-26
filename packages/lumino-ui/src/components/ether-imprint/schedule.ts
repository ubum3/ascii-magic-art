// When and where EtherImprint stamps the brandmark, as pure numbers (tested in test/bg-36.test.mjs).

/** Where on the brand gradient each imprint's colours start: warm, cool, coral, lavender. */
export const IMPRINT_HUES = [0.0, 0.62, 0.18, 0.78] as const;

export interface Imprint {
  /** Which imprint this is, counting from 0. */
  index: number;
  /** Seconds since it began. */
  age: number;
  /** Centre x, y (0 to 1 of the box, y up) and the mark square's side, as a share of the box height. */
  at: [number, number, number];
  /** Where on the gradient its colours start. */
  hue: number;
  /** Which way it curls as it blooms: 1 or -1. */
  turn: 1 | -1;
}

/**
 * The imprint under way at `time` (seconds), one every `period` seconds, for a box of
 * this aspect. Wide boxes take turns between the four corners' sides; tall ones between
 * the top and the bottom. Never the middle, where a card sits.
 */
export function imprintAt(time: number, period: number, aspect: number): Imprint {
  const index = Math.max(0, Math.floor(time / period));
  const age = time - index * period;
  const wide = aspect >= 0.9;
  const spots: [number, number][] = wide
    ? [[0.8, 0.36], [0.2, 0.64], [0.8, 0.66], [0.2, 0.34]]
    : [[0.5, 0.8], [0.5, 0.2]];
  const [x, y] = spots[index % spots.length]!;
  // A mark about half the height on wide boxes; on tall ones, most of the width.
  const size = wide ? 0.62 : Math.min(0.62, aspect * 1.05);
  return { index, age, at: [x, y, size], hue: IMPRINT_HUES[index % IMPRINT_HUES.length]!, turn: index % 2 ? -1 : 1 };
}
