"use client";

/**
 * GradientASCII from React Bits (reactbits.dev, MIT + Commons Clause), ported
 * to TypeScript: a WebGL2 gradient drawn as a grid of characters, for
 * full-bleed backgrounds. The shaders are upstream's, unchanged (glsl.ts); the
 * container/canvas styles moved from its CSS file to inline styles, since
 * lumino-ui ships no CSS. Without WebGL2 it renders nothing (the container's
 * background shows through). Ported from lumino-services
 * (packages/ui/src/backgrounds/gradient-ascii.tsx).
 *
 * Two additions over upstream: `marks` draw vector shapes into the glyph
 * atlas in place of a character, and `words` are stamped onto random cells
 * over the field (typed in, held, faded) through a cols × rows overlay
 * texture the glyph shader samples once per cell (overlay.ts).
 *
 * And, for lumino-ui's backgrounds: `paused` freezes it on one frame, `onReady`
 * fires after the first frame is drawn, and `dpr` caps the device pixel ratio
 * rather than replacing it. Like upstream, it pauses off screen and in hidden
 * tabs, and draws one still frame with prefers-reduced-motion.
 */
import * as React from "react";

import type { VectorMark } from "../../brand/brand.js";
import { BLUR, COMPOSITE, FIELD, HALO, VERTEX } from "./glsl.js";
import {
  type Stamp,
  glyphList,
  markTable,
  spawnStamp,
  wordIndices,
  writeOverlay,
} from "./overlay.js";

const MAX_COLORS = 8;
const MAX_CLICKS = 4;
const MAX_TRAIL = 24;
const CLICK_LIFE = 1.2;
const TRAIL_LIFE = 0.7;
const TRAIL_STEP = 0.015;
const INTRO_SECONDS = 2.4;
const ATLAS_CELL_W = 60;
const ATLAS_CELL_H = 100;
const ATLAS_COLUMNS = 16;
const FONT_SCALE = 0.78;
const DEFAULT_COLORS = ["#1e3fd8", "#f6f8ff", "#a5d8ff", "#38bdf8"];
const DEFAULT_CHARACTERS = " =+xX0S8#@";
const DEFAULT_FONT =
  '"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
const NO_MARKS: readonly AsciiMark[] = [];
const NO_WORDS: readonly string[] = [];
const FULL_BAND: readonly [number, number] = [0, 1];
const SHAPES = { horizon: 0, pinch: 1, rise: 2, eclipse: 3 } as const;
const CLICK_EFFECTS = { none: 0, wave: 1, burst: 2 } as const;
// The styles upstream had as CSS (Tailwind `relative h-full w-full overflow-hidden`, and
// `absolute inset-0 block h-full w-full` on the canvas). Inline, a `style` with
// `position: absolute` now wins, so the root can be positioned directly.
const ROOT_STYLE: React.CSSProperties = { position: "relative", width: "100%", height: "100%", overflow: "hidden" };
const CANVAS_STYLE: React.CSSProperties = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" };

type Rgb = [number, number, number];

interface Program {
  program: WebGLProgram;
  uniforms: Record<string, WebGLUniformLocation | null>;
}

interface Target {
  textures: WebGLTexture[];
  framebuffer: WebGLFramebuffer | null;
  width: number;
  height: number;
}

interface Atlas {
  texture: WebGLTexture | null;
  /** Glyphs in the atlas: the ramp, then word-only characters. */
  count: number;
  /** Glyphs the tone pick may choose from (the ramp alone). */
  rampCount: number;
  grid: [number, number];
}

interface TrailPoint {
  x: number;
  y: number;
  age: number;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toLinear = (value: number) =>
  value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;

const toLab = ([r, g, b]: Rgb): Rgb => {
  const lr = toLinear(r);
  const lg = toLinear(g);
  const lb = toLinear(b);
  const l = Math.cbrt(
    0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb,
  );
  const m = Math.cbrt(
    0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb,
  );
  const s = Math.cbrt(
    0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb,
  );
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
};

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (
  gl: WebGL2RenderingContext,
  fragmentSource: string,
): Program | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Program["uniforms"] = {};
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const name = info.name.replace(/\[0\]$/, "");
    uniforms[name] = gl.getUniformLocation(program, name);
  }
  return { program, uniforms };
};

const createTarget = (gl: WebGL2RenderingContext, count: number): Target => {
  const textures = Array.from({ length: count }, () => {
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return texture;
  });
  return { textures, framebuffer: gl.createFramebuffer(), width: 0, height: 0 };
};

const sizeTarget = (
  gl: WebGL2RenderingContext,
  target: Target,
  width: number,
  height: number,
) => {
  if (target.width === width && target.height === height) return;
  target.width = width;
  target.height = height;
  gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
  target.textures.forEach((texture, i) => {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA8,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      null,
    );
    gl.framebufferTexture2D(
      gl.FRAMEBUFFER,
      gl.COLOR_ATTACHMENT0 + i,
      gl.TEXTURE_2D,
      texture,
      0,
    );
  });
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
};

/** Draw a vector mark centred on (cx, cy), fitting a `box` px square. */
const drawMark = (
  context: CanvasRenderingContext2D,
  mark: AsciiMark,
  cx: number,
  cy: number,
  box: number,
) => {
  const [vw, vh] = mark.viewBox;
  const k = (box / Math.max(vw, vh, 1)) * (mark.scale ?? 1);
  context.save();
  context.translate(cx - (vw * k) / 2, cy - (vh * k) / 2);
  context.scale(k, k);
  mark.paths.forEach((d) => context.fill(new Path2D(d)));
  context.restore();
};

const buildAtlas = (
  gl: WebGL2RenderingContext,
  glyphs: { list: string[]; rampCount: number },
  marks: readonly AsciiMark[],
  fontFamily: string,
): Atlas => {
  const { list, rampCount } = glyphs;
  const font = `300 ${Math.round(ATLAS_CELL_H * FONT_SCALE)}px ${fontFamily}`;
  const box = Math.min(ATLAS_CELL_W, ATLAS_CELL_H * FONT_SCALE);
  const columns = Math.min(ATLAS_COLUMNS, list.length);
  const rows = Math.ceil(list.length / columns);
  const canvas = document.createElement("canvas");
  canvas.width = ATLAS_CELL_W * columns;
  canvas.height = ATLAS_CELL_H * rows;
  const context = canvas.getContext("2d");
  if (context) {
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "#fff";
    list.forEach((char, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const cx = column * ATLAS_CELL_W + ATLAS_CELL_W / 2;
      const cy = row * ATLAS_CELL_H + ATLAS_CELL_H / 2 + 3;
      const mark = marks.find((item) => item.key === char);
      if (mark && typeof Path2D !== "undefined") {
        // Clip to the cell so a scaled-up mark never bleeds into a neighbour.
        context.save();
        context.beginPath();
        context.rect(
          column * ATLAS_CELL_W,
          row * ATLAS_CELL_H,
          ATLAS_CELL_W,
          ATLAS_CELL_H,
        );
        context.clip();
        drawMark(context, mark, cx, cy, box);
        context.restore();
      } else {
        context.fillText(char, cx, cy);
      }
    });
  }
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.LINEAR_MIPMAP_LINEAR,
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return { texture, count: list.length, rampCount, grid: [columns, rows] };
};

/**
 * A vector shape drawn into the atlas in place of one character: a VectorMark
 * such as BRANDMARK (`bounds` is optional and unused; the mark is fitted by
 * its viewBox).
 */
export interface AsciiMark extends Pick<VectorMark, "viewBox" | "paths">, Partial<Pick<VectorMark, "bounds">> {
  /** The character in `characters` this mark replaces. */
  key: string;
  /** Size relative to a glyph (1 fills the glyph box). */
  scale?: number;
  /**
   * Share of lit cells (0 to 1) that show this mark regardless of their
   * tone, re-rolled every second or so. Up to four marks may have one.
   */
  chance?: number;
}

export interface GradientASCIIProps extends Omit<
  React.ComponentPropsWithoutRef<"div">,
  "children"
> {
  /** Two to eight colors, from the edge of the shadow to the brightest point. */
  colors?: readonly string[];
  shape?: keyof typeof SHAPES;
  /** Characters from dimmest to brightest. */
  characters?: string;
  /**
   * Vector marks drawn in place of a character: put the mark's `key` in
   * `characters` where it should sit in the dim-to-bright ramp.
   */
  marks?: readonly AsciiMark[];
  /**
   * Words stamped over the field at random cells: typed in, held, faded.
   * Characters outside `characters` are added to the atlas for the words
   * alone.
   */
  words?: readonly string[];
  /** Word stamps per second; 0 turns them off. */
  wordRate?: number;
  /** Seconds a stamped word stays, fade included. */
  wordLife?: number;
  /**
   * Where words may land, as [top, bottom] fractions of the height from the
   * top of the view; `[0, 0.5]` is the top half. Whole height by default.
   */
  wordBand?: readonly [number, number];
  /** Ink of stamped words (any CSS color); light grey, or near-black in light mode, by default. */
  wordColor?: string;
  /** Opacity of a stamped word at full strength (0 to 1); `glyphOpacity` by default. */
  wordOpacity?: number;
  /** Height of each character cell in px. */
  cellSize?: number;
  density?: number;
  glyphOpacity?: number;
  glow?: number;
  depthOfField?: number;
  flicker?: number;
  softness?: number;
  scale?: number;
  flow?: number;
  speed?: number;
  gradientOpacity?: number;
  grain?: number;
  variation?: number;
  mouseInteraction?: boolean;
  scrambleRadius?: number;
  clickEffect?: keyof typeof CLICK_EFFECTS;
  intro?: boolean;
  lightMode?: boolean;
  fontFamily?: string;
  /** Maximum device pixel ratio, capped at 2. Default 2. */
  dpr?: number;
  /** Freezes the animation on the current frame (the intro, if running, jumps to its end). Default false. */
  paused?: boolean;
  /** Called once, after the first frame is drawn (never without WebGL2). */
  onReady?: () => void;
}

/** GradientASCII's own props, without the div's. */
export type GradientASCIIOptions = Omit<
  GradientASCIIProps,
  keyof React.ComponentPropsWithoutRef<"div">
>;

export function GradientASCII({
  colors = DEFAULT_COLORS,
  shape = "horizon",
  characters = DEFAULT_CHARACTERS,
  marks = NO_MARKS,
  words = NO_WORDS,
  wordRate = 1.5,
  wordLife = 2.5,
  wordBand = FULL_BAND,
  wordColor,
  wordOpacity,
  cellSize = 18,
  density = 0.8,
  glyphOpacity = 0.85,
  glow = 0.2,
  depthOfField = 0,
  flicker = 0.2,
  softness = 0.5,
  scale = 1,
  flow = 0.5,
  speed = 1,
  gradientOpacity = 0.9,
  grain = 0.08,
  variation = 0,
  mouseInteraction = true,
  scrambleRadius = 0.1,
  clickEffect = "wave",
  intro = true,
  lightMode = false,
  fontFamily = DEFAULT_FONT,
  dpr,
  paused = false,
  onReady,
  style,
  ...rest
}: GradientASCIIProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const wakeRef = React.useRef<(() => void) | null>(null);
  const palette = (
    Array.isArray(colors) && colors.length ? colors : DEFAULT_COLORS
  ).slice(0, MAX_COLORS);
  const settings = {
    colors: palette.length > 1 ? palette : [palette[0], palette[0]],
    shape: SHAPES[shape] ?? 0,
    characters: characters || DEFAULT_CHARACTERS,
    marks,
    words: words.filter((word) => word.length > 0),
    wordRate: Math.max(0, wordRate),
    wordLife: Math.max(0.3, wordLife),
    wordBand,
    wordColor,
    wordOpacity: clamp(wordOpacity ?? glyphOpacity, 0, 1),
    cellSize: clamp(cellSize, 6, 64),
    density: clamp(density, 0, 1),
    glyphOpacity: clamp(glyphOpacity, 0, 1),
    glow: clamp(glow, 0, 2),
    depthOfField: clamp(depthOfField, 0, 1),
    flicker: clamp(flicker, 0, 1),
    softness: clamp(softness, 0, 1),
    scale: clamp(scale, 0.4, 2.5),
    flow: clamp(flow, 0, 2),
    speed: Math.max(0, speed),
    gradientOpacity: clamp(gradientOpacity, 0, 1),
    grain: clamp(grain, 0, 0.4),
    variation: Math.max(0, variation),
    mouseInteraction,
    scrambleRadius: clamp(scrambleRadius, 0.02, 0.4),
    clickEffect: CLICK_EFFECTS[clickEffect] ?? 1,
    intro,
    lightMode,
    fontFamily: fontFamily || DEFAULT_FONT,
    dpr,
    paused,
    onReady,
  };
  const settingsRef = React.useRef(settings);
  // Layout effects run before the render loop's effect below, so the loop
  // always reads this render's props.
  React.useLayoutEffect(() => {
    settingsRef.current = settings;
  });

  React.useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    const gl = canvas?.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!container || !canvas || !gl) return undefined;

    const field = link(gl, FIELD);
    const halo = link(gl, HALO);
    const blur = link(gl, BLUR);
    const composite = link(gl, COMPOSITE);
    if (!field || !halo || !blur || !composite) return undefined;
    const vao = gl.createVertexArray();
    const fieldTarget = createTarget(gl, 2);
    const haloA = createTarget(gl, 1);
    const haloB = createTarget(gl, 1);

    const probe = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true });
    const colorCache = new Map<string, Rgb>();
    const parse = (value: string): Rgb => {
      const key = String(value);
      const cached = colorCache.get(key);
      if (cached) return cached;
      let rgb: Rgb = [0, 0, 0];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#000000";
        probe.fillStyle = key;
        probe.fillRect(0, 0, 1, 1);
        const [r = 0, g = 0, b = 0] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r / 255, g / 255, b / 255];
      }
      colorCache.set(key, rgb);
      return rgb;
    };

    const reduce =
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const view = { width: 1, height: 1, ratio: 1 };
    const ramp = new Float32Array(MAX_COLORS * 3);
    const clickData = new Float32Array(MAX_CLICKS * 4);
    const clicks: TrailPoint[] = [];
    const trailData = new Float32Array(MAX_TRAIL * 4);
    const trail: TrailPoint[] = [];
    const pointer = { x: 0, y: 0, inside: false };
    let atlas: Atlas | null = null;
    let atlasKey = "";
    let wordGlyphs: number[][] = [];
    let markData = markTable([], []);
    const stamps: Stamp[] = [];
    let spawnClock = 0;
    let nextSpawn = 0.6;
    const grid = { cols: 0, rows: 0, buffer: new Uint8Array(0) };
    let overlayDirty = false;
    let overlayLive = false;
    const overlay = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, overlay);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    // Two bytes per cell: a row of an odd column count is not 4-aligned.
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    let paletteKey = "";

    // The glyph grid the shaders address: the cell size behind uCell and the
    // cell count behind uOffset.
    const gridSize = () => {
      const cellH = settingsRef.current.cellSize * view.ratio;
      const cellW = cellH * (ATLAS_CELL_W / ATLAS_CELL_H);
      return {
        cellW,
        cellH,
        cols: Math.ceil(canvas.width / cellW),
        rows: Math.ceil(canvas.height / cellH),
      };
    };

    // Keep the overlay texture at the grid's size and push the stamps to it.
    const syncOverlay = () => {
      const { cols, rows } = gridSize();
      gl.bindTexture(gl.TEXTURE_2D, overlay);
      if (cols !== grid.cols || rows !== grid.rows) {
        grid.cols = cols;
        grid.rows = rows;
        grid.buffer = new Uint8Array(cols * rows * 2);
        stamps.length = 0;
        overlayLive = false;
        overlayDirty = false;
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RG8,
          cols,
          rows,
          0,
          gl.RG,
          gl.UNSIGNED_BYTE,
          grid.buffer,
        );
        return;
      }
      if (!overlayDirty) return;
      overlayDirty = false;
      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        0,
        0,
        cols,
        rows,
        gl.RG,
        gl.UNSIGNED_BYTE,
        grid.buffer,
      );
    };

    // Spawn a word every ~1/wordRate seconds (jittered), age the live ones
    // out, and rewrite the overlay while any is showing (once more after the
    // last one dies, to clear it).
    const updateStamps = (dt: number) => {
      const s = settingsRef.current;
      const spawning =
        !reduce &&
        !s.paused &&
        wordGlyphs.length > 0 &&
        s.wordRate > 0 &&
        grid.cols > 0;
      if (spawning) {
        spawnClock += dt;
        if (spawnClock >= nextSpawn) {
          spawnClock = 0;
          nextSpawn = (0.6 + 0.8 * Math.random()) / s.wordRate;
          const stamp = spawnStamp(
            wordGlyphs,
            grid.cols,
            grid.rows,
            Math.random,
            s.wordBand,
          );
          if (stamp) stamps.push(stamp);
        }
      }
      if (!stamps.length && !overlayLive) return;
      stamps.forEach((stamp) => {
        stamp.age += dt;
      });
      for (let i = stamps.length - 1; i >= 0; i--) {
        if (stamps[i]!.age >= s.wordLife) stamps.splice(i, 1);
      }
      overlayLive = writeOverlay(
        stamps,
        grid.cols,
        grid.rows,
        s.wordLife,
        grid.buffer,
      );
      overlayDirty = true;
    };
    let time = 0;
    let glyphTime = 0;
    let introClock = settingsRef.current.intro && !reduce ? 0 : 1;
    let frameSeed = 0;
    let grainClock = 0;
    let raf = 0;
    let last = 0;
    let visible = true;
    let disposed = false;
    let drawn = false;

    const syncAtlas = () => {
      const s = settingsRef.current;
      const key = [
        s.fontFamily,
        s.characters,
        s.words.join("\n"),
        s.marks
          .map(
            (mark) =>
              `${mark.key}${mark.scale ?? 1}${mark.chance ?? 0}${mark.paths.join("")}`,
          )
          .join("\u0001"),
      ].join("|");
      if (key === atlasKey && atlas) return;
      atlasKey = key;
      const glyphs = glyphList(s.characters, s.words);
      wordGlyphs = s.words
        .map((word) => wordIndices(word, glyphs.list))
        .filter((word) => word.length > 0);
      markData = markTable(s.marks, glyphs.list);
      // Live stamps index the old atlas; the next frame clears the overlay.
      stamps.length = 0;
      const build = () => {
        if (atlas) gl.deleteTexture(atlas.texture);
        atlas = buildAtlas(gl, glyphs, s.marks, s.fontFamily);
      };
      build();
      // Redraw once the font has loaded; the first atlas may use a fallback.
      document.fonts
        ?.load?.(`300 64px ${s.fontFamily}`, glyphs.list.join(""))
        .then(
          () => {
            if (disposed || atlasKey !== key) return;
            build();
            draw();
          },
          () => {},
        );
    };

    const syncPalette = () => {
      const s = settingsRef.current;
      const key = s.colors.join(",");
      if (key === paletteKey) return;
      paletteKey = key;
      s.colors.forEach((color, i) => ramp.set(toLab(parse(color)), i * 3));
    };

    const bindGlyphs = (program: Program, width: number, height: number) => {
      if (!atlas) return;
      const s = settingsRef.current;
      const u = program.uniforms;
      const { cellW, cellH, cols, rows } = gridSize();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[0]);
      gl.uniform1i(u.uField, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fieldTarget.textures[1]);
      gl.uniform1i(u.uAux, 1);
      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, atlas.texture);
      gl.uniform1i(u.uAtlas, 2);
      gl.uniform2f(u.uResolution, width, height);
      gl.uniform2f(u.uCell, cellW, cellH);
      gl.uniform2f(
        u.uOffset,
        (width - cols * cellW) / 2,
        (height - rows * cellH) / 2,
      );
      gl.uniform2f(u.uAtlasGrid, atlas.grid[0], atlas.grid[1]);
      gl.uniform1f(u.uCount, atlas.rampCount);
      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, overlay);
      gl.uniform1i(u.uOverlay, 4);
      gl.uniform2f(u.uGrid, cols, rows);
      gl.uniform2fv(u.uMarks, markData);
      const ink: Rgb = s.wordColor
        ? parse(s.wordColor)
        : s.lightMode
          ? [0.1, 0.1, 0.1]
          : [0.85, 0.85, 0.85];
      gl.uniform3f(u.uWordInk, ink[0], ink[1], ink[2]);
      gl.uniform1f(u.uWordOpacity, s.wordOpacity);
      gl.uniform1f(u.uDensity, s.density);
      gl.uniform1f(u.uOpacity, s.glyphOpacity);
      gl.uniform1f(u.uFlicker, reduce ? 0 : s.flicker);
      gl.uniform1f(u.uDepth, s.depthOfField);
      gl.uniform1f(u.uGlyphTime, glyphTime);
      gl.uniform1f(u.uSeedValue, s.variation);
      gl.uniform1f(u.uLight, s.lightMode ? 1 : 0);
    };

    const draw = () => {
      const s = settingsRef.current;
      const aspect = view.width / view.height;
      syncAtlas();
      syncPalette();
      syncOverlay();
      gl.bindVertexArray(vao);
      gl.disable(gl.BLEND);

      gl.bindFramebuffer(gl.FRAMEBUFFER, fieldTarget.framebuffer);
      gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);
      gl.viewport(0, 0, fieldTarget.width, fieldTarget.height);
      gl.useProgram(field.program);
      const fu = field.uniforms;
      gl.uniform1f(fu.uAspect, aspect);
      gl.uniform1f(fu.uTime, time);
      gl.uniform1i(fu.uShape, s.shape);
      gl.uniform3fv(fu.uRamp, ramp);
      gl.uniform1i(fu.uCount, s.colors.length);
      gl.uniform1f(fu.uScale, s.scale);
      gl.uniform1f(fu.uSoftness, s.softness);
      gl.uniform1f(fu.uFlow, s.flow);
      gl.uniform2f(fu.uSeed, s.variation * 3.17, s.variation * 1.91);
      gl.uniform4fv(fu.uTrail, trailData);
      gl.uniform1f(fu.uRadius, s.scrambleRadius);
      gl.uniform4fv(fu.uClicks, clickData);
      gl.uniform1i(fu.uClickEffect, s.clickEffect);
      gl.uniform1f(fu.uIntro, introClock);
      gl.uniform1f(fu.uFrame, frameSeed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      const glowing = s.glow > 0.001;
      if (glowing) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
        gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
        gl.viewport(0, 0, haloA.width, haloA.height);
        gl.useProgram(halo.program);
        bindGlyphs(halo, canvas.width, canvas.height);
        gl.uniform1f(halo.uniforms.uDownscale, canvas.width / haloA.width);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        gl.useProgram(blur.program);
        gl.activeTexture(gl.TEXTURE0);
        gl.uniform1i(blur.uniforms.uSource, 0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, haloB.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
        gl.uniform2f(blur.uniforms.uStep, 1 / haloA.width, 0);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        gl.bindFramebuffer(gl.FRAMEBUFFER, haloA.framebuffer);
        gl.bindTexture(gl.TEXTURE_2D, haloB.textures[0]);
        gl.uniform2f(blur.uniforms.uStep, 0, 1 / haloA.height);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(composite.program);
      bindGlyphs(composite, canvas.width, canvas.height);
      const cu = composite.uniforms;
      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, haloA.textures[0]);
      gl.uniform1i(cu.uHalo, 3);
      gl.uniform1f(cu.uGlow, glowing ? s.glow : 0);
      gl.uniform1f(cu.uGradient, s.gradientOpacity);
      gl.uniform1f(cu.uGrain, s.grain);
      gl.uniform1f(cu.uFrame, frameSeed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!drawn) {
        drawn = true;
        s.onReady?.();
      }
    };

    const resize = () => {
      const s = settingsRef.current;
      view.width = Math.max(1, container.clientWidth);
      view.height = Math.max(1, container.clientHeight);
      // A cap, as documented (upstream used `dpr` as the ratio itself).
      view.ratio = Math.min(window.devicePixelRatio || 1, s.dpr || 2, 2);
      canvas.width = Math.max(1, Math.round(view.width * view.ratio));
      canvas.height = Math.max(1, Math.round(view.height * view.ratio));
      sizeTarget(
        gl,
        fieldTarget,
        Math.max(1, Math.round(canvas.width / 2)),
        Math.max(1, Math.round(canvas.height / 2)),
      );
      const haloWidth = Math.max(1, Math.round(canvas.width / 4));
      const haloHeight = Math.max(1, Math.round(canvas.height / 4));
      sizeTarget(gl, haloA, haloWidth, haloHeight);
      sizeTarget(gl, haloB, haloWidth, haloHeight);
      draw();
      wake();
    };

    const updateInput = (dt: number) => {
      trail.forEach((point) => {
        point.age += dt;
      });
      while (trail.length && trail[trail.length - 1]!.age > TRAIL_LIFE)
        trail.pop();
      for (let i = 0; i < MAX_TRAIL; i++) {
        const point = trail[i];
        if (!point) {
          trailData[i * 4 + 2] = 0;
          continue;
        }
        const k = 1 - point.age / TRAIL_LIFE;
        trailData.set([point.x, point.y, k * k, 0], i * 4);
      }
      clicks.forEach((click) => {
        click.age += dt;
      });
      while (clicks.length && clicks[clicks.length - 1]!.age > CLICK_LIFE)
        clicks.pop();
      for (let i = 0; i < MAX_CLICKS; i++) {
        const click = clicks[i];
        if (!click) {
          clickData[i * 4 + 3] = 0;
          continue;
        }
        const k = click.age / CLICK_LIFE;
        const envelope = Math.min(1, click.age / 0.08) * (1 - k) * (1 - k);
        clickData.set([click.x, click.y, click.age, envelope], i * 4);
      }
    };

    const frame = (now: number) => {
      raf = 0;
      if (disposed || !visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = last ? clamp((now - last) / 1000, 0.001, 0.05) : 1 / 60;
      last = now;
      // Paused: hold this frame (stamps included) and stop the loop.
      const frozen = reduce || s.paused;
      if (!frozen) {
        time += dt * s.speed * 0.5;
        glyphTime += dt * Math.max(s.speed, 0.15);
      }
      if (introClock < 1)
        introClock = s.paused
          ? 1
          : Math.min(1, introClock + dt / INTRO_SECONDS);
      grainClock += dt;
      if (!frozen && grainClock > 1 / 24) {
        grainClock = 0;
        frameSeed = (frameSeed + 1) % 97;
      }
      updateInput(dt);
      updateStamps(s.paused ? 0 : dt);
      draw();
      const busy =
        !frozen ||
        introClock < 1 ||
        clicks.length > 0 ||
        trail.length > 0 ||
        (stamps.length > 0 && !s.paused);
      if (busy) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    function wake() {
      if (!raf && !disposed && visible && !document.hidden)
        raf = requestAnimationFrame(frame);
    }

    const locate = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = 1 - (event.clientY - rect.top) / Math.max(1, rect.height);
      const aspect = rect.width / Math.max(1, rect.height);
      pointer.inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      pointer.x = (x - 0.5) * aspect;
      pointer.y = y - 0.5;
    };

    const onPointerMove = (event: PointerEvent) => {
      locate(event);
      const s = settingsRef.current;
      if (!pointer.inside || !s.mouseInteraction || reduce || s.paused)
        return;
      const head = trail[0];
      const gap = head
        ? Math.hypot(pointer.x - head.x, pointer.y - head.y)
        : Infinity;
      if (gap < TRAIL_STEP) return;
      if (head && head.age < 0.1) {
        const steps = Math.min(6, Math.floor(gap / (TRAIL_STEP * 2)));
        for (let i = 1; i <= steps; i++) {
          const k = i / (steps + 1);
          trail.unshift({
            x: head.x + (pointer.x - head.x) * k,
            y: head.y + (pointer.y - head.y) * k,
            age: 0,
          });
        }
      }
      trail.unshift({ x: pointer.x, y: pointer.y, age: 0 });
      trail.length = Math.min(trail.length, MAX_TRAIL);
      wake();
    };

    const onPointerDown = (event: PointerEvent) => {
      locate(event);
      const s = settingsRef.current;
      if (!pointer.inside || !s.clickEffect || reduce || s.paused) return;
      clicks.unshift({ x: pointer.x, y: pointer.y, age: 0 });
      if (clicks.length > MAX_CLICKS) clicks.pop();
      wake();
    };

    const onVisibility = () => {
      last = 0;
      wake();
    };

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    const intersection = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible) {
        last = 0;
        wake();
      }
    });
    intersection.observe(container);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wakeRef.current = wake;

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("visibilitychange", onVisibility);
      [fieldTarget, haloA, haloB].forEach((target) => {
        target.textures.forEach((texture) => gl.deleteTexture(texture));
        gl.deleteFramebuffer(target.framebuffer);
      });
      if (atlas) gl.deleteTexture(atlas.texture);
      gl.deleteTexture(overlay);
      gl.deleteVertexArray(vao);
      [field, halo, blur, composite].forEach((item) =>
        gl.deleteProgram(item.program),
      );
      // Free the context only once the canvas is gone: React's StrictMode
      // remounts on the same canvas, whose getContext would return the lost one.
      setTimeout(() => {
        if (!canvas.isConnected)
          gl.getExtension("WEBGL_lose_context")?.loseContext();
      }, 0);
    };
  }, []);

  React.useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div
      ref={containerRef}
      style={{ ...ROOT_STYLE, ...style }}
      {...rest}
    >
      <canvas ref={canvasRef} style={CANVAS_STYLE} aria-hidden="true" />
    </div>
  );
}

/** GradientASCII under lumino-ui's naming. */
export const GradientAscii = GradientASCII;
export type GradientAsciiProps = GradientASCIIProps;
