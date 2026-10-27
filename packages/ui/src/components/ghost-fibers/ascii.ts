// GhostFibers' optional ASCII pass (not from React Bits): glyphs picked by each cell's brightness, drawn over the fibers.

/** The glyph ramp, darkest to brightest, without duplicates or line breaks; a space when empty. */
export function asciiRamp(characters: string): string[] {
  const list = [...new Set([...characters].filter((c) => c !== "\n" && c !== "\r"))];
  return list.length ? list : [" "];
}

/**
 * A vector shape drawn as a glyph, like GradientASCII's marks: SVG `d` strings over
 * a viewBox, fitted to the glyph box. It shows on a `chance` share of lit cells,
 * whatever their brightness, re-rolled every second or so.
 */
export interface AsciiGlyphMark {
  viewBox: readonly [number, number];
  paths: readonly string[];
  /** Size relative to the glyph box (1 fits it). Default 1. */
  scale?: number;
  /** Share of lit cells (0 to 1) that show it. Default 0. */
  chance?: number;
}

/** Marks the shader can take (its uniform array length). */
export const MAX_GLYPH_MARKS = 4;

/**
 * The shader's mark table: (atlas index, chance) pairs, the marks placed after the
 * `rampCount` ramp glyphs, zero-padded to MAX_GLYPH_MARKS. Marks past the limit are dropped.
 */
export function glyphMarkTable(marks: readonly AsciiGlyphMark[], rampCount: number): Float32Array<ArrayBuffer> {
  const table = new Float32Array(MAX_GLYPH_MARKS * 2);
  marks.slice(0, MAX_GLYPH_MARKS).forEach((mark, i) => {
    table[i * 2] = rampCount + i;
    table[i * 2 + 1] = Math.min(1, Math.max(0, mark.chance ?? 0));
  });
  return table;
}

/** Atlas columns: the ramp is laid out in rows of this many glyphs. */
export const ATLAS_COLUMNS = 16;

/** The atlas's grid for a ramp of `count` glyphs: [columns, rows]. */
export function atlasGrid(count: number): [number, number] {
  const columns = Math.max(1, Math.min(ATLAS_COLUMNS, count));
  return [columns, Math.ceil(count / columns)];
}

/**
 * Draw the ramp, then the marks, into a canvas, one glyph per `cellWidth` x
 * `cellHeight` cell (device pixels, so the shader samples it 1:1 and the glyphs
 * stay sharp), white on clear.
 */
export function buildGlyphAtlas(
  ramp: readonly string[], marks: readonly AsciiGlyphMark[], fontFamily: string, cellWidth: number, cellHeight: number,
): HTMLCanvasElement {
  const shapes = marks.slice(0, MAX_GLYPH_MARKS);
  const [columns, rows] = atlasGrid(ramp.length + shapes.length);
  const canvas = document.createElement("canvas");
  canvas.width = columns * cellWidth;
  canvas.height = rows * cellHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `${Math.max(1, Math.round(cellHeight * 0.82))}px ${fontFamily}`;
  ramp.forEach((glyph, i) => {
    const x = (i % columns) * cellWidth + cellWidth / 2;
    const y = Math.floor(i / columns) * cellHeight + cellHeight / 2 + cellHeight * 0.04;
    ctx.fillText(glyph, x, y);
  });
  // Each mark fitted to the glyph box by its viewBox, clipped so a scaled-up one can't bleed into a neighbour.
  const box = Math.min(cellWidth, cellHeight * 0.82);
  shapes.forEach((mark, i) => {
    const slot = ramp.length + i;
    const left = (slot % columns) * cellWidth, top = Math.floor(slot / columns) * cellHeight;
    const [vw, vh] = mark.viewBox;
    const k = (box / Math.max(vw, vh, 1)) * (mark.scale ?? 1);
    ctx.save();
    ctx.beginPath();
    ctx.rect(left, top, cellWidth, cellHeight);
    ctx.clip();
    ctx.translate(left + cellWidth / 2 - (vw * k) / 2, top + cellHeight / 2 - (vh * k) / 2);
    ctx.scale(k, k);
    mark.paths.forEach((d) => ctx.fill(new Path2D(d)));
    ctx.restore();
  });
  return canvas;
}

/**
 * The glyph pass. Each cell averages the composited fibers (3 x 3 taps), picks a
 * glyph by coverage (or, on a uMarks chance share of lit cells, a mark), and draws
 * it in the cell's own hue. uMode 1 lays the glyphs
 * over the fibers (dimming them a little so the glyphs read), 2 draws only glyphs.
 * Premultiplied in, premultiplied out, so the canvas stays clear between fibers.
 */
export const ASCII_FRAGMENT = `#version 300 es
precision highp float;
uniform sampler2D uPicture;
uniform sampler2D uAtlas;
uniform vec2 uView;
uniform vec2 uCell;
uniform vec2 uAtlasGrid;
uniform float uCount;
uniform float uMode;
uniform float uOpacity;
uniform vec2 uMarks[4];
uniform float uTime;
in vec2 vUv;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
out vec4 outColor;

void main() {
  vec2 px = vUv * uView;
  vec2 cell = floor(px / uCell);
  vec2 local = (px - cell * uCell) / uCell;
  vec4 sum = vec4(0.0);
  for (int i = 0; i < 3; i++) {
    for (int j = 0; j < 3; j++) {
      sum += texture(uPicture, (cell + (vec2(float(i), float(j)) + 0.5) / 3.0) * uCell / uView);
    }
  }
  vec4 c = sum / 9.0;
  // Cells are mostly empty between fibers, so lift the ramp hard: a third covered is the densest glyph.
  float level = clamp(pow(c.a * 3.0, 0.55), 0.0, 1.0);
  float index = floor(level * (uCount - 1.0) + 0.5);
  // Marks take their share of cells whatever the tone, each cell re-rolled every second or so.
  float swap = floor(uTime * 0.6 + hash12(cell * 1.73 + 4.1) * 4.0);
  float roll = hash12(cell * 4.37 + swap * 2.9);
  float edge = 0.0;
  for (int i = 0; i < 4; i++) {
    if (uMarks[i].y <= 0.0) continue;
    if (roll >= edge && roll < edge + uMarks[i].y) index = uMarks[i].x;
    edge += uMarks[i].y;
  }
  vec2 slot = vec2(mod(index, uAtlasGrid.x), floor(index / uAtlasGrid.x));
  float ink = texture(uAtlas, (slot + vec2(local.x, 1.0 - local.y)) / uAtlasGrid).a;
  vec3 hue = clamp(c.rgb / max(c.a, 1e-4), 0.0, 1.0);
  float strength = ink * smoothstep(0.015, 0.06, c.a) * mix(0.6, 1.0, level) * uOpacity;
  vec4 glyph = vec4(mix(hue, vec3(1.0), 0.25) * strength, strength);
  vec4 picture = uMode > 1.5 ? vec4(0.0) : texture(uPicture, vUv) * (1.0 - 0.35 * uOpacity);
  outColor = glyph + picture * (1.0 - glyph.a);
}`;

export const ASCII_UNIFORMS = ["uPicture", "uAtlas", "uView", "uCell", "uAtlasGrid", "uCount", "uMode", "uOpacity", "uMarks", "uTime"];
