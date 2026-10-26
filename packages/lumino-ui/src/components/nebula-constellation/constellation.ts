// The brandmark as a constellation, and where its stars and lines are at a given time.

/**
 * The stars, on the centre lines of the mark's three strokes, in units of the
 * mark's height with (0, 0) at its middle and y up (from the 2000 viewBox:
 * x' = (x - 1000) / 1111, y' = (1000 - y) / 1111).
 */
const VIEWBOX_STARS: readonly (readonly [number, number])[] = [
  [1048, 447], [952, 447], // the tips, where the blades meet
  [1071.5, 878.7], [1265, 1213.8], [1627.5, 1450], // right blade
  [928.5, 878.7], [735, 1213.8], [372.5, 1450], // left blade
  [1580, 1534], [1199, 1340], [801, 1340], [420, 1534], // the base
  [1060, 663], [940, 663], [1446, 1332], [553.75, 1332], [1000, 1340], [1390, 1437], [610, 1437], // between
];

export const STARS: readonly (readonly [number, number])[] = VIEWBOX_STARS.map(([x, y]) => [(x - 1000) / 1111, (1000 - y) / 1111]);

/** The lines, as [from, to, delay]: the delay (0 to 1) orders the drawing, from the tips down both blades, then the base from its middle. */
export const EDGES: readonly (readonly [number, number, number])[] = [
  [1, 0, 0],
  [0, 12, 0.12], [12, 2, 0.24], [2, 3, 0.36], [3, 14, 0.48], [14, 4, 0.6],
  [1, 13, 0.12], [13, 5, 0.24], [5, 6, 0.36], [6, 15, 0.48], [15, 7, 0.6],
  [16, 9, 0.62], [9, 17, 0.76], [17, 8, 0.9],
  [16, 10, 0.62], [10, 18, 0.76], [18, 11, 0.9],
];

/** The SDF square's side, in the same units: the mark's tight width (1280.67) over the 0.76 of the square it fills (padding 0.12). */
export const MARK_SQUARE = 1280.67 / 1111 / 0.76;

/** The seconds one form, hold and dissolve takes. */
export const CYCLE = 14;
/** Where in the cycle time 0 falls: already formed, so the first frame shows the mark. */
export const START = 5.5;

export interface ConstellationFrame {
  /** Centre and size (screen units per mark height) of this cycle's mark. */
  center: [number, number];
  size: number;
  /** Each star: x, y, brightness. */
  stars: Float32Array;
  /** Each line: x0, y0, x1, y1 (shortened while it draws), and its opacity. */
  lines: Float32Array;
  lineAlpha: Float32Array;
  /** How much the glass fill shows, 0 to 1. */
  fill: number;
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** The places the mark forms in, away from a centred card, in turn. Units of the height, y up. */
export function slots(aspect: number): { centers: [number, number][]; size: number } {
  if (aspect < 1) {
    const size = Math.min(0.18, aspect * 0.36);
    return { centers: [[aspect * 0.5, 0.85], [aspect * 0.5, 0.15]], size };
  }
  const x = Math.min(0.2 * aspect, 0.42);
  return {
    centers: [[x, 0.7], [aspect - x, 0.3], [aspect - x, 0.7], [x, 0.3]],
    size: Math.min(0.4, 0.15 * aspect + 0.12),
  };
}

/** Everything the shader needs for one frame. */
export function constellationAt(time: number, aspect: number, scale = 1): ConstellationFrame {
  const tt = time + START;
  const k = Math.floor(tt / CYCLE);
  const ph = tt - k * CYCLE;
  const { centers, size: base } = slots(aspect);
  const center = centers[((k % centers.length) + centers.length) % centers.length]!;
  const size = base * scale;

  const gather = smooth(0, 3.5, ph);
  const scatter = smooth(10, 13, ph);
  const stars = new Float32Array(STARS.length * 3);
  STARS.forEach(([x, y], i) => {
    const a = hash(k * 31 + i) * Math.PI * 2, r = 0.5 + hash(k * 17 + i * 3) * 0.8;
    const b = hash((k + 1) * 31 + i + 7) * Math.PI * 2, s = 0.6 + hash(k * 13 + i * 5) * 0.9;
    const away = 1 - gather;
    stars[i * 3] = center[0] + (x + Math.cos(a) * r * away + Math.cos(b) * s * scatter) * size;
    stars[i * 3 + 1] = center[1] + (y + Math.sin(a) * r * away + Math.sin(b) * s * scatter) * size;
    stars[i * 3 + 2] = (0.3 + 0.7 * gather * (1 - scatter)) * (i < 12 ? 1 : 0.7);
  });

  const lines = new Float32Array(EDGES.length * 4);
  const lineAlpha = new Float32Array(EDGES.length);
  EDGES.forEach(([from, to, delay], i) => {
    const reveal = smooth(2.4 + delay * 2.4, 3.0 + delay * 2.4, ph);
    const x0 = stars[from * 3]!, y0 = stars[from * 3 + 1]!, x1 = stars[to * 3]!, y1 = stars[to * 3 + 1]!;
    lines[i * 4] = x0;
    lines[i * 4 + 1] = y0;
    lines[i * 4 + 2] = x0 + (x1 - x0) * reveal;
    lines[i * 4 + 3] = y0 + (y1 - y0) * reveal;
    lineAlpha[i] = reveal > 0 ? (1 - smooth(9.6, 11, ph)) : 0;
  });

  const fill = smooth(4.8, 6.8, ph) * (1 - smooth(9.2, 10.6, ph));
  return { center: [center[0], center[1]], size, stars, lines, lineAlpha, fill };
}
