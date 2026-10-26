// The pure word-overlay helpers of GradientASCII (from lumino-services gradient-ascii-overlay.ts).
/**
 * The pure half of GradientASCII's word overlay: which glyphs the atlas
 * holds, and the "stamps" (words typed onto random grid cells that hold and
 * fade) written into a cols × rows RG byte grid the shader samples per cell.
 * No DOM or WebGL here so it runs under plain vitest.
 */

/** Seconds a stamp takes to fade in, type one glyph, and fade out. */
export const STAMP_IN = 0.1;
export const STAMP_TYPE = 0.07;
export const STAMP_OUT = 0.5;

export interface Stamp {
  col: number;
  row: number;
  /** Atlas indices, one per cell from `col` rightwards. */
  glyphs: number[];
  /** Seconds since the stamp appeared. */
  age: number;
}

/**
 * The atlas contents: the deduped ramp (dim → bright) first, then any word
 * character the ramp lacks. `rampCount` bounds the shader's tone pick; the
 * atlas itself holds `list.length` glyphs.
 */
export function glyphList(
  characters: string,
  words: readonly string[],
): { list: string[]; rampCount: number } {
  const list = [
    ...new Set(
      [...characters].filter((char) => char !== "\n" && char !== "\r"),
    ),
  ];
  if (!list.length) list.push(" ");
  const rampCount = list.length;
  for (const word of words) {
    for (const char of word) {
      if (char === "\n" || char === "\r" || list.includes(char)) continue;
      list.push(char);
    }
  }
  return { list, rampCount };
}

/** Marks the shader can force by chance (its uniform array length). */
export const MAX_MARKS = 4;

/**
 * The shader's mark table: (atlas index, chance) pairs for marks that take a
 * share of lit cells regardless of tone, zero-padded to `MAX_MARKS`. Marks
 * with no chance, or whose key is not in the atlas, take no slot.
 */
export function markTable(
  marks: readonly { key: string; chance?: number }[],
  list: readonly string[],
): Float32Array {
  const table = new Float32Array(MAX_MARKS * 2);
  let slot = 0;
  for (const mark of marks) {
    const chance = Math.min(1, Math.max(0, mark.chance ?? 0));
    const index = list.indexOf(mark.key);
    if (chance <= 0 || index < 0 || slot >= MAX_MARKS) continue;
    table[slot * 2] = index;
    table[slot * 2 + 1] = chance;
    slot++;
  }
  return table;
}

/** A word as atlas indices; characters outside the atlas are dropped. */
export function wordIndices(word: string, list: readonly string[]): number[] {
  return [...word]
    .map((char) => list.indexOf(char))
    .filter((index) => index >= 0);
}

/**
 * The rows a band may use, as [first, last]. The band is [top, bottom] as
 * fractions of the height from the top of the view; rows count from the
 * bottom (GL convention), so the band is flipped. At least one row.
 */
export function bandRows(
  rows: number,
  band: readonly [number, number],
): [number, number] {
  const top = Math.min(1, Math.max(0, band[0]));
  const bottom = Math.min(1, Math.max(top, band[1]));
  const first = Math.min(rows - 1, Math.floor(rows * (1 - bottom)));
  const last = Math.max(first, Math.ceil(rows * (1 - top)) - 1);
  return [first, last];
}

/**
 * A new stamp of a random word at a random cell that fits the grid, inside
 * the vertical `band` (whole height by default), or null when no word fits.
 * `random` is a [0, 1) source (Math.random in production).
 */
export function spawnStamp(
  words: readonly (readonly number[])[],
  cols: number,
  rows: number,
  random: () => number,
  band: readonly [number, number] = [0, 1],
): Stamp | null {
  const fitting = words.filter(
    (word) => word.length > 0 && word.length <= cols,
  );
  if (!fitting.length || rows < 1) return null;
  const glyphs = [...fitting[Math.floor(random() * fitting.length)]!];
  const col = Math.floor(random() * (cols - glyphs.length + 1));
  const [first, last] = bandRows(rows, band);
  const row = first + Math.floor(random() * (last - first + 1));
  return { col, row, glyphs, age: 0 };
}

/** How many glyphs of a stamp have been typed so far (at least one). */
export function visibleGlyphs(age: number): number {
  return Math.floor(Math.max(0, age) / STAMP_TYPE) + 1;
}

/** 0 at birth, 1 after `STAMP_IN`, back to 0 at `life`. */
export function stampStrength(age: number, life: number): number {
  const rise = Math.min(1, age / STAMP_IN);
  const fall = Math.min(1, (life - age) / STAMP_OUT);
  return Math.max(0, Math.min(1, Math.min(rise, fall)));
}

/**
 * Fill `buffer` (cols × rows × 2 bytes, row-major from row 0) with the live
 * stamps: R = atlas index + 1 (0 = no stamp), G = strength × 255. A later
 * stamp overwrites an earlier one on a shared cell. Returns whether any cell
 * was written.
 */
export function writeOverlay(
  stamps: readonly Stamp[],
  cols: number,
  rows: number,
  life: number,
  buffer: Uint8Array,
): boolean {
  buffer.fill(0);
  let written = false;
  for (const stamp of stamps) {
    const strength = Math.round(stampStrength(stamp.age, life) * 255);
    if (strength <= 0 || stamp.row < 0 || stamp.row >= rows) continue;
    const shown = Math.min(stamp.glyphs.length, visibleGlyphs(stamp.age));
    for (let i = 0; i < shown; i++) {
      const col = stamp.col + i;
      if (col < 0 || col >= cols) continue;
      const at = (stamp.row * cols + col) * 2;
      buffer[at] = Math.min(255, stamp.glyphs[i]! + 1);
      buffer[at + 1] = strength;
      written = true;
    }
  }
  return written;
}
