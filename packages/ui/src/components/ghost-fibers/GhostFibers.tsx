"use client";
/*
 * GhostFibers, from React Bits (reactbits.dev, MIT + Commons Clause): twisting
 * ribbons of glowing fibers drawn with WebGL2, with depth of field, bloom and dust.
 * The cursor pulls the focus or parts the fibers; a click sends a pulse along a
 * ribbon. Ported to TypeScript; the CSS file is inlined as styles, since this
 * package ships no CSS. It fills its container, so give the container a size.
 */
import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import {
  CAMERA, FOV, RIBBON_LENGTH, DOT_VERTEX, DUST_VERTEX, DOT_FRAGMENT, FULLSCREEN, BRIGHT_FRAGMENT, DOWN_FRAGMENT, UP_FRAGMENT,
  COMPOSITE_FRAGMENT,
} from "./glsl.js";

export type GhostFibersGradient = "depth" | "along" | "across";
export type GhostFibersStyle = "dots" | "dashes" | "lines";
export type GhostFibersHover = "focus" | "part" | "none";

export interface GhostFibersProps extends HTMLAttributes<HTMLDivElement> {
  /** Main colour of the fibers. Default #8b5cf6. */
  glowColor?: string;
  /** Colour of the bright folds, sparkles and tips. Default: a pale tint of glowColor. */
  lineColor?: string;
  /** Second colour the gradient blends toward. Default: a deeper shade of glowColor. */
  secondaryColor?: string;
  /** How the two colours blend: by distance, along the ribbons, or across them. Default depth. */
  gradient?: GhostFibersGradient;
  /** Number of ribbons, 1 to 3. Default 3. */
  layers?: number;
  /** How much the ribbons undulate. 0 keeps them straight. Default 1. */
  waves?: number;
  /** How often the ribbons turn over along their length. Default 1.2. */
  twist?: number;
  /** Thickness of each ribbon, from a flat sheet at 0 to a layered bundle. Default 0.7. */
  volume?: number;
  /** Width of the ribbons. Default 1. */
  spread?: number;
  /** Size of the whole effect. Default 1. */
  scale?: number;
  /** Tilt of the whole effect, in degrees. Default 18. */
  rotation?: number;
  /** How far the ribbons turn into the distance, 0 (side-on) to 1. Default 0.65. */
  perspective?: number;
  /** Fibers in each ribbon. Default 72. */
  threads?: number;
  /** Dots along each fiber. Default 1. */
  density?: number;
  /** Size of the dots. Default 1. */
  thickness?: number;
  /** Rows of dots, short dashes or continuous lines. Default dots. */
  fiberStyle?: GhostFibersStyle;
  /** Cuts the fibers at different lengths and lights their ends. Default 0. */
  tips?: number;
  /** Brightness where the ribbons fold edge-on. Default 1. */
  foldGlow?: number;
  /** Speed of the waves and the twist. Default 0.5. */
  speed?: number;
  /** Speed of the dots along the fibers; negative reverses. Default 0.4. */
  flow?: number;
  /** How fast the ribbons roll around their length. Default 0.15. */
  rollSpeed?: number;
  /** Camera blur away from the focus. 0 keeps everything sharp. Default 0.85. */
  depthOfField?: number;
  /** Moves the focus nearer (negative) or farther (positive). Default 0. */
  focusDepth?: number;
  /** Amount of floating dust. Default 0.5. */
  particles?: number;
  /** How often single dots twinkle. Default 0.5. */
  sparkle?: number;
  /** Bloom around the bright areas. Default 0.8. */
  glow?: number;
  /** Overall brightness. Default 1. */
  brightness?: number;
  /** How much the edges fade out, 0 to 1. Default 0.3. */
  vignette?: number;
  /** Strength of the film grain. Default 0.06. */
  grain?: number;
  /** The view follows the cursor slightly and the hover effect is on. Default true. */
  mouseInteraction?: boolean;
  /** Pull the focus to the ribbon under the cursor, part the fibers around it, or nothing. Default focus. */
  hoverEffect?: GhostFibersHover;
  /** Strength of the hover effect. Default 1. */
  mouseStrength?: number;
  /** Sends a pulse of light along the ribbon you click. Default true. */
  pulseOnClick?: boolean;
  /** Draws the ribbons in from one end at first. Default true. */
  intro?: boolean;
  /** Draws the fibers as coloured ink for light backgrounds. Default false. */
  lightMode?: boolean;
  /** Freezes the animation. Default false. */
  paused?: boolean;
  /** Maximum device pixel ratio, capped at 2. Default: the screen's. */
  dpr?: number;
}

type Vec3 = [number, number, number];
type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };
type Target = { texture: WebGLTexture | null; framebuffer: WebGLFramebuffer | null; width: number; height: number };
type Camera = { eye: Vec3; viewProj: number[]; orient: number[] };

const MAX_RENDER_DIM = 2400;
const BLOOM_LEVELS = 5;
const INTRO_SECONDS = 2.6;
const HOVER_EFFECTS: Record<GhostFibersHover, number> = { focus: 0, part: 1, none: 2 };
const FIBER_STYLES: Record<GhostFibersStyle, number> = { dots: 0, dashes: 0.45, lines: 1 };
const GRADIENTS: Record<GhostFibersGradient, number> = { depth: 0, along: 1, across: 2 };
const RIBBON_TINT = [0, 0.75, 0.35];
const PLACEMENTS = [
  [0, 0, 0, 0],
  [1.9, -4.6, -0.08, 2.4],
  [-1.05, 2.0, 0.12, 4.1],
];
const RIBBON_GAIN = [1, 0.5, 0.55];
const DEG = Math.PI / 180;
const CONTAINER: CSSProperties = { position: "relative", width: "100%", height: "100%", overflow: "hidden" };
const CANVAS: CSSProperties = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" };

const SHAPE_UNIFORMS = ["uTime", "uTwist", "uRoll", "uWaves", "uWidth", "uRibbon", "uOrient", "uScale", "uPlace", "uVolume"];
const DOT_UNIFORMS = [
  ...SHAPE_UNIFORMS, "uViewProj", "uEye", "uViewport", "uDpr", "uFibers", "uDots", "uFlow", "uSize", "uFocus", "uDof", "uMaxCoc",
  "uFocal", "uIntro", "uPulse", "uHover", "uPart", "uDotLength", "uSparkle", "uDepthSpread", "uGain", "uTips", "uTint", "uGradient",
  "uFold", "uGlowColor", "uLineColor", "uSecondaryColor",
];
const DUST_UNIFORMS = [
  "uViewProj", "uViewport", "uDpr", "uTime", "uSize", "uFocus", "uDof", "uMaxCoc", "uFocal", "uIntro", "uSparkle", "uScale",
  "uGradient", "uGain", "uGlowColor", "uLineColor", "uSecondaryColor",
];
const PASS_UNIFORMS = ["uSource", "uTexel"];
const COMPOSITE_UNIFORMS = ["uScene", "uBloom", "uGlow", "uBrightness", "uLightMode", "uGrain", "uVignette", "uFrame", "uView", "uDpr"];

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const compile = (gl: WebGL2RenderingContext, type: number, source: string) => {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) return shader;
  gl.deleteShader(shader);
  return null;
};

const link = (gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string, names: string[]): Program | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
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
  for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
  return { program, uniforms };
};

const frustum = (fov: number, aspect: number, near: number, far: number) => {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0];
};

const multiply = (a: number[], b: number[]) => {
  const out = new Array<number>(16);
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      out[col * 4 + row] =
        a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
    }
  }
  return out;
};

const orientation = (yaw: number, pitch: number, roll: number) => {
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const cr = Math.cos(roll);
  const sr = Math.sin(roll);
  const ry = [cy, 0, -sy, 0, 1, 0, sy, 0, cy];
  const rx = [1, 0, 0, 0, cp, sp, 0, -sp, cp];
  const rz = [cr, sr, 0, -sr, cr, 0, 0, 0, 1];
  const mul = (a: number[], b: number[]) => {
    const out = new Array<number>(9);
    for (let col = 0; col < 3; col += 1) {
      for (let row = 0; row < 3; row += 1) {
        out[col * 3 + row] = a[row] * b[col * 3] + a[3 + row] * b[col * 3 + 1] + a[6 + row] * b[col * 3 + 2];
      }
    }
    return out;
  };
  return mul(rz, mul(rx, ry));
};

const applyMat3 = (m: number[], v: number[]): Vec3 => [
  m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
  m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
  m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
];

export function GhostFibers({
  glowColor = "#8b5cf6",
  lineColor,
  secondaryColor,
  gradient = "depth",
  speed = 0.5,
  scale = 1,
  rotation = 18,
  rollSpeed = 0.15,
  layers = 3,
  waves = 1,
  twist = 1.2,
  threads = 72,
  volume = 0.7,
  spread = 1,
  density = 1,
  thickness = 1,
  flow = 0.4,
  fiberStyle = "dots",
  tips = 0,
  foldGlow = 1,
  perspective = 0.65,
  depthOfField = 0.85,
  focusDepth = 0,
  particles = 0.5,
  sparkle = 0.5,
  glow = 0.8,
  brightness = 1,
  vignette = 0.3,
  grain = 0.06,
  mouseInteraction = true,
  hoverEffect = "focus",
  mouseStrength = 1,
  pulseOnClick = true,
  intro = true,
  lightMode = false,
  paused = false,
  dpr,
  className = "",
  style,
  ...rest
}: GhostFibersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings = {
    glowColor: String(glowColor),
    lineColor: lineColor ? String(lineColor) : "",
    secondaryColor: secondaryColor ? String(secondaryColor) : "",
    gradient: GRADIENTS[gradient] ?? 0,
    speed: Math.max(0, speed),
    scale: clamp(scale, 0.3, 3),
    rotation: rotation * DEG,
    rollSpeed,
    layers: clamp(Math.round(layers), 1, 3),
    waves: Math.max(0, waves),
    twist: Math.max(0, twist),
    threads: clamp(Math.round(threads), 6, 180),
    volume: clamp(volume, 0, 2),
    spread: clamp(spread, 0.2, 3),
    density: clamp(density, 0.2, 3),
    thickness: clamp(thickness, 0.2, 4),
    flow,
    dotLength: FIBER_STYLES[fiberStyle] ?? 0,
    tips: clamp(tips, 0, 1),
    foldGlow: clamp(foldGlow, 0, 3),
    perspective: clamp(perspective, 0, 1),
    depthOfField: clamp(depthOfField, 0, 2),
    focusDepth: clamp(focusDepth, -1, 1),
    particles: clamp(particles, 0, 2),
    sparkle: clamp(sparkle, 0, 2),
    glow: Math.max(0, glow),
    brightness: Math.max(0, brightness),
    vignette: clamp(vignette, 0, 1),
    grain: Math.max(0, grain),
    mouseInteraction,
    hover: HOVER_EFFECTS[hoverEffect] ?? 0,
    mouseStrength: Math.max(0, mouseStrength),
    pulseOnClick,
    intro,
    lightMode,
    paused,
    dpr,
  };
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
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

    const floatTargets = !!gl.getExtension("EXT_color_buffer_float");
    const dots = link(gl, DOT_VERTEX, DOT_FRAGMENT, DOT_UNIFORMS);
    const dust = link(gl, DUST_VERTEX, DOT_FRAGMENT, DUST_UNIFORMS);
    const bright = link(gl, FULLSCREEN, BRIGHT_FRAGMENT, PASS_UNIFORMS);
    const down = link(gl, FULLSCREEN, DOWN_FRAGMENT, PASS_UNIFORMS);
    const up = link(gl, FULLSCREEN, UP_FRAGMENT, PASS_UNIFORMS);
    const composite = link(gl, FULLSCREEN, COMPOSITE_FRAGMENT, COMPOSITE_UNIFORMS);
    if (!dots || !dust || !bright || !down || !up || !composite) return undefined;

    const format = floatTargets ? gl.RGBA16F : gl.RGBA8;
    const makeTarget = (): Target => ({ texture: null, framebuffer: gl.createFramebuffer(), width: 0, height: 0 });
    const allocate = (target: Target, width: number, height: number) => {
      if (target.texture && target.width === width && target.height === height) return;
      if (target.texture) gl.deleteTexture(target.texture);
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texStorage2D(gl.TEXTURE_2D, 1, format, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
      target.texture = texture;
      target.width = width;
      target.height = height;
    };
    const scene = makeTarget();
    const chain = Array.from({ length: BLOOM_LEVELS }, makeTarget);
    const vao = gl.createVertexArray();

    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const state = {
      time: 0,
      roll: 0,
      flow: 0,
      frame: 0,
      intro: settingsRef.current.intro && !reduce ? 0 : INTRO_SECONDS,
      width: 1,
      height: 1,
      fit: 1,
      colorKey: "",
      glow: [0.55, 0.36, 0.96] as Vec3,
      line: [1, 0.85, 0.98] as Vec3,
      secondary: [0.44, 0.29, 0.77] as Vec3,
      pointer: { x: 0, y: 0, inside: false },
      hover: { x: 0, y: 0, presence: 0, placed: false },
      look: { x: 0, y: 0, vx: 0, vy: 0 },
      focus: CAMERA + settingsRef.current.focusDepth * 3,
      pulse: { s: 0, age: 9, strength: 0, ribbon: 0 },
      camera: null as Camera | null,
    };
    let raf = 0;
    let last = 0;
    let visible = true;
    let alive = true;

    const toRgb = (value: string, fallback: Vec3): Vec3 => {
      if (!probeContext || !value) return fallback;
      const css = /^[0-9a-f]{3,8}$/i.test(value) ? `#${value}` : value;
      probeContext.clearRect(0, 0, 1, 1);
      probeContext.fillStyle = "#000000";
      probeContext.fillStyle = css;
      probeContext.fillRect(0, 0, 1, 1);
      const [r, g, b] = probeContext.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255];
    };

    const resolveColors = (s: typeof settings) => {
      const key = `${s.glowColor}|${s.lineColor}|${s.secondaryColor}|${s.lightMode}`;
      if (key === state.colorKey) return;
      state.colorKey = key;
      state.glow = toRgb(s.glowColor, [0.55, 0.36, 0.96]);
      state.secondary = s.secondaryColor ? toRgb(s.secondaryColor, state.glow) : (state.glow.map((c) => c * 0.8) as Vec3);
      if (s.lineColor) state.line = toRgb(s.lineColor, state.glow);
      else state.line = s.lightMode ? state.glow : (state.glow.map((c) => c + (1 - c) * 0.72) as Vec3);
    };

    // The shader's centerLocal, in JS, to find the ribbon under the cursor.
    const centerLocal = (s: number, t: number, ribbon: number, waves: number): Vec3 => {
      const place = PLACEMENTS[ribbon];
      const ph = place[3];
      const x = s * RIBBON_LENGTH;
      const y =
        waves * (0.52 * Math.sin(x * 0.43 + t * 0.31 + ph) + 0.26 * Math.sin(x * 0.79 - t * 0.23 + 1.3 + ph * 0.7)) +
        place[0] +
        x * place[2];
      const z = waves * 0.65 * Math.sin(x * 0.33 + t * 0.19 + 0.7 + ph * 1.3) + place[1];
      return [x, y, z];
    };

    const cameraFor = (s: typeof settings): Camera => {
      const aspect = state.width / Math.max(state.height, 1);
      const eye: Vec3 = [0, 0, CAMERA];
      const projection = frustum(FOV, aspect, 0.1, 60);
      const view = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -eye[0], -eye[1], -eye[2], 1];
      const orient = orientation(s.perspective * 0.85 + state.look.x * 0.22, 0.12 - state.look.y * 0.14, s.rotation);
      return { eye, viewProj: multiply(projection, view), orient };
    };

    const screenOf = (camera: Camera, world: Vec3) => {
      const m = camera.viewProj;
      const x = m[0] * world[0] + m[4] * world[1] + m[8] * world[2] + m[12];
      const y = m[1] * world[0] + m[5] * world[1] + m[9] * world[2] + m[13];
      const w = m[3] * world[0] + m[7] * world[1] + m[11] * world[2] + m[15];
      return { x: ((x / w) * 0.5 + 0.5) * state.width, y: (0.5 - (y / w) * 0.5) * state.height, depth: w };
    };

    const nearestOnRibbon = (s: typeof settings, px: number, py: number) => {
      const camera = state.camera;
      if (!camera) return null;
      let best: { gap: number; s: number; ribbon: number; depth: number } | null = null;
      for (let ribbon = 0; ribbon < s.layers; ribbon += 1) {
        for (let i = 0; i <= 96; i += 1) {
          const u = i / 96 - 0.5;
          const local = centerLocal(u, state.time, ribbon, s.waves).map((c) => c * s.scale * state.fit);
          const world = applyMat3(camera.orient, local);
          const screen = screenOf(camera, world);
          const gap = Math.hypot(screen.x - px, screen.y - py);
          if (!best || gap < best.gap) best = { gap, s: u, ribbon, depth: screen.depth };
        }
      }
      return best;
    };

    const resize = () => {
      const s = settingsRef.current;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const baseDpr = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      const longest = Math.max(width, height) * baseDpr;
      const ratio = longest > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longest : baseDpr;
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth;
        canvas.height = pixelHeight;
      }
      state.width = width;
      state.height = height;
      state.fit = clamp(width / height / 1.5, 0.6, 1);
      render();
    };

    const drawPass = (program: Program, target: Target, source: Target, texel: [number, number]) => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(program.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, source.texture);
      gl.uniform1i(program.uniforms.uSource, 0);
      gl.uniform2f(program.uniforms.uTexel, texel[0], texel[1]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const render = () => {
      const s = settingsRef.current;
      resolveColors(s);
      const camera = cameraFor(s);
      state.camera = camera;
      const ratio = canvas.height / Math.max(state.height, 1);
      const intro = s.paused || reduce ? 1 : clamp(state.intro / INTRO_SECONDS, 0, 1);
      const introEase = 1 - (1 - intro) * (1 - intro) * (1 - intro);

      allocate(scene, canvas.width, canvas.height);
      gl.bindVertexArray(vao);
      gl.bindFramebuffer(gl.FRAMEBUFFER, scene.framebuffer);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE);

      const dotsPerFiber = Math.round(260 * s.density);
      const blurCap = 22 * clamp(Math.sqrt(56000 / (s.threads * dotsPerFiber * s.layers)), 0.45, 1);
      const area = Math.max(0.8 * s.thickness, 0.45) ** 2 / 0.64;
      const load = Math.pow((s.threads / 72) * s.density * area, -0.75);
      gl.useProgram(dots.program);
      const u = dots.uniforms;
      gl.uniform1f(u.uTime, state.time);
      gl.uniform1f(u.uTwist, s.twist);
      gl.uniform1f(u.uRoll, state.roll);
      gl.uniform1f(u.uWaves, s.waves);
      gl.uniform1f(u.uWidth, 0.62 * s.spread);
      gl.uniformMatrix3fv(u.uOrient, false, camera.orient);
      gl.uniform1f(u.uScale, s.scale * state.fit);
      gl.uniformMatrix4fv(u.uViewProj, false, camera.viewProj);
      gl.uniform3f(u.uEye, camera.eye[0], camera.eye[1], camera.eye[2]);
      gl.uniform2f(u.uViewport, canvas.width, canvas.height);
      gl.uniform1f(u.uDpr, ratio);
      gl.uniform1f(u.uFibers, s.threads);
      gl.uniform1f(u.uDots, dotsPerFiber);
      gl.uniform1f(u.uFlow, state.flow);
      gl.uniform1f(u.uSize, 1.6 * s.thickness);
      gl.uniform1f(u.uFocus, state.focus);
      gl.uniform1f(u.uDof, s.depthOfField);
      gl.uniform1f(u.uMaxCoc, blurCap);
      gl.uniform1f(u.uFocal, CAMERA);
      gl.uniform1f(u.uIntro, introEase);
      gl.uniform4f(u.uPulse, state.pulse.s, state.pulse.age, state.pulse.strength, state.pulse.ribbon);
      gl.uniform4f(
        u.uHover,
        state.hover.x * ratio,
        (state.height - state.hover.y) * ratio,
        140 * ratio,
        state.hover.presence * s.mouseStrength,
      );
      gl.uniform1f(u.uPart, s.hover === 1 ? 1 : 0);
      gl.uniform1f(u.uDotLength, s.dotLength);
      gl.uniform1f(u.uSparkle, s.sparkle);
      gl.uniform1f(u.uDepthSpread, 0.12);
      gl.uniform1f(u.uVolume, s.volume);
      gl.uniform3f(u.uGlowColor, state.glow[0], state.glow[1], state.glow[2]);
      gl.uniform3f(u.uLineColor, state.line[0], state.line[1], state.line[2]);
      gl.uniform3f(u.uSecondaryColor, state.secondary[0], state.secondary[1], state.secondary[2]);
      gl.uniform1f(u.uTips, s.tips);
      gl.uniform1f(u.uGradient, s.gradient);
      gl.uniform1f(u.uFold, s.foldGlow);
      for (let ribbon = 0; ribbon < s.layers; ribbon += 1) {
        const place = PLACEMENTS[ribbon];
        gl.uniform1f(u.uRibbon, ribbon);
        gl.uniform4f(u.uPlace, place[0], place[1], place[2], place[3]);
        gl.uniform1f(u.uGain, RIBBON_GAIN[ribbon] * load);
        gl.uniform1f(u.uTint, RIBBON_TINT[ribbon]);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, s.threads * dotsPerFiber);
      }

      const dustCount = Math.round(420 * s.particles);
      if (dustCount > 0) {
        gl.useProgram(dust.program);
        const d = dust.uniforms;
        gl.uniformMatrix4fv(d.uViewProj, false, camera.viewProj);
        gl.uniform2f(d.uViewport, canvas.width, canvas.height);
        gl.uniform1f(d.uDpr, ratio);
        gl.uniform1f(d.uTime, state.time);
        gl.uniform1f(d.uSize, 2.2 * s.thickness);
        gl.uniform1f(d.uFocus, state.focus);
        gl.uniform1f(d.uDof, s.depthOfField);
        gl.uniform1f(d.uMaxCoc, 22);
        gl.uniform1f(d.uFocal, CAMERA);
        gl.uniform1f(d.uIntro, introEase);
        gl.uniform1f(d.uSparkle, s.sparkle);
        gl.uniform1f(d.uScale, s.scale * state.fit);
        gl.uniform1f(d.uGradient, s.gradient);
        gl.uniform1f(d.uGain, 1 / s.thickness);
        gl.uniform3f(d.uGlowColor, state.glow[0], state.glow[1], state.glow[2]);
        gl.uniform3f(d.uLineColor, state.line[0], state.line[1], state.line[2]);
        gl.uniform3f(d.uSecondaryColor, state.secondary[0], state.secondary[1], state.secondary[2]);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, dustCount);
      }
      gl.disable(gl.BLEND);

      const blooming = s.glow > 0.001 && !s.lightMode;
      gl.bindVertexArray(vao);
      if (blooming) {
        chain.forEach((target, index) => {
          allocate(
            target,
            Math.max(1, Math.round(canvas.width / 2 ** (index + 1))),
            Math.max(1, Math.round(canvas.height / 2 ** (index + 1))),
          );
        });
        drawPass(bright, chain[0], scene, [0.5 / scene.width, 0.5 / scene.height]);
        for (let index = 1; index < BLOOM_LEVELS; index += 1) {
          drawPass(down, chain[index], chain[index - 1], [1 / chain[index - 1].width, 1 / chain[index - 1].height]);
        }
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.ONE, gl.ONE);
        for (let index = BLOOM_LEVELS - 1; index > 0; index -= 1) {
          drawPass(up, chain[index - 1], chain[index], [0.5 / chain[index].width, 0.5 / chain[index].height]);
        }
        gl.disable(gl.BLEND);
      }

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(composite.program);
      const c = composite.uniforms;
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, scene.texture);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, blooming ? chain[0].texture : scene.texture);
      gl.uniform1i(c.uScene, 0);
      gl.uniform1i(c.uBloom, 1);
      gl.uniform1f(c.uGlow, blooming ? s.glow : 0);
      gl.uniform1f(c.uBrightness, s.brightness);
      gl.uniform1f(c.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform1f(c.uGrain, s.grain);
      gl.uniform1f(c.uVignette, s.vignette);
      gl.uniform1f(c.uFrame, state.frame % 977);
      gl.uniform2f(c.uView, canvas.width, canvas.height);
      gl.uniform1f(c.uDpr, ratio);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, null);
      gl.bindVertexArray(null);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const s = settingsRef.current;
      const elapsed = last ? (now - last) / 1000 : 1 / 60;
      const dt = Math.min(0.05, elapsed);
      last = now;
      const moving = !s.paused && !reduce;
      if (moving) {
        state.frame += 1;
        state.time += dt * s.speed;
        state.roll += dt * s.speed * s.rollSpeed;
        state.flow += dt * s.flow * 12;
        state.intro += Math.min(elapsed, 1);
      } else if (state.intro < INTRO_SECONDS) {
        state.intro = INTRO_SECONDS;
      }
      state.pulse.age += dt;
      state.pulse.strength = Math.max(0, 1 - state.pulse.age / 1.8) ** 2;

      const { pointer, hover, look } = state;
      const active = s.mouseInteraction && pointer.inside && !reduce;
      if (active && !hover.placed) {
        hover.x = pointer.x;
        hover.y = pointer.y;
        hover.placed = true;
      }
      hover.x += (pointer.x - hover.x) * (1 - Math.exp(-dt / 0.08));
      hover.y += (pointer.y - hover.y) * (1 - Math.exp(-dt / 0.08));
      const goal = active ? 1 : 0;
      hover.presence += (goal - hover.presence) * (1 - Math.exp(-dt / (goal > hover.presence ? 0.3 : 0.6)));
      if (!active && hover.presence < 0.001) hover.placed = false;
      const lookX = active ? (pointer.x / state.width - 0.5) * 0.5 : 0;
      const lookY = active ? (0.5 - pointer.y / state.height) * 0.5 : 0;
      look.vx += (30 * (lookX - look.x) - 11 * look.vx) * dt;
      look.vy += (30 * (lookY - look.y) - 11 * look.vy) * dt;
      look.x += look.vx * dt;
      look.y += look.vy * dt;

      const resting = CAMERA + s.focusDepth * 3;
      let focusGoal = resting;
      if (active && s.hover === 0) {
        const near = nearestOnRibbon(s, hover.x, hover.y);
        if (near) focusGoal = resting + (near.depth - resting) * hover.presence * Math.min(1, s.mouseStrength);
      }
      state.focus += (focusGoal - state.focus) * (1 - Math.exp(-dt / 0.35));

      render();
      const settling =
        Math.abs(goal - hover.presence) > 0.002 ||
        Math.abs(lookX - look.x) > 0.0002 ||
        Math.abs(lookY - look.y) > 0.0002 ||
        Math.abs(focusGoal - state.focus) > 0.001 ||
        state.pulse.strength > 0.001;
      if (moving || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      state.pointer.x = x;
      state.pointer.y = y;
      state.pointer.inside = x >= 0 && y >= 0 && x <= rect.width && y <= rect.height;
      wake();
    };

    const onPointerDown = (event: PointerEvent) => {
      const s = settingsRef.current;
      if (!s.mouseInteraction || !s.pulseOnClick || event.button !== 0 || reduce) return;
      if (event.target instanceof Element && event.target.closest('a, button, input, textarea, select, label, [role="button"]')) return;
      const rect = container.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      const near = nearestOnRibbon(s, x, y);
      if (near) state.pulse = { s: near.s, age: 0, strength: 1, ribbon: near.ribbon };
      wake();
    };

    const onPointerLeave = () => {
      state.pointer.inside = false;
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
    window.addEventListener("pointerdown", onPointerDown);
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();
    wake();

    wakeRef.current = () => {
      if (!raf) render();
      wake();
    };

    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", onPointerDown);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteVertexArray(vao);
      [scene, ...chain].forEach((target) => {
        if (target.texture) gl.deleteTexture(target.texture);
        gl.deleteFramebuffer(target.framebuffer);
      });
      [dots, dust, bright, down, up, composite].forEach((entry) => gl.deleteProgram(entry.program));
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div ref={containerRef} className={`ghost-fibers-container${className ? ` ${className}` : ""}`} style={{ ...CONTAINER, ...style }} {...rest}>
      <canvas ref={canvasRef} className="ghost-fibers-canvas" style={CANVAS} aria-hidden="true" />
    </div>
  );
}

export default GhostFibers;
