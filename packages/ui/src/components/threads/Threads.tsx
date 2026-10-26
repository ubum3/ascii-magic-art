"use client";
/*
 * Threads, from React Bits (reactbits.dev, MIT + Commons Clause): a bundle of fine
 * threads drawn with WebGL2 that peel apart into waves. The cursor can steer the
 * waves and part the threads. Ported to TypeScript; the CSS file is inlined as
 * styles, since this package ships no CSS. It fills its container, so give the
 * container a size.
 */
import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { LINE_VERTEX, LINE_FRAGMENT, SCREEN_VERTEX, SCREEN_FRAGMENT } from "./glsl.js";

/** Any CSS colour, or an RGB array from 0 to 1. */
export type ThreadsColor = string | number[];

export interface ThreadsProps extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** Colour of the threads. Default [1, 1, 1] (white). */
  color?: ThreadsColor;
  /** Colour the outer threads blend toward. Default: none, a single colour. */
  accentColor?: ThreadsColor;
  /** Number of threads. Default 90. */
  lineCount?: number;
  /** Width of the threads. Default 0.6. */
  thickness?: number;
  /** How much the threads soften as they separate. 0 keeps every thread crisp. Default 1.3. */
  softness?: number;
  /** Height of the waves. Default 1.7. */
  amplitude?: number;
  /** Spacing between the threads. 0 starts them all from one line. Default 0.4. */
  distance?: number;
  /** How many waves run along each thread. Default 1.05. */
  waves?: number;
  /** Animation speed. 0 holds the threads still. Default 0.6. */
  speed?: number;
  /** Where the first thread leaves the bundle, 0 (start) to 1 (end). Default 0.04. */
  split?: number;
  /** How gradually the other threads peel away after the first. Default 0.5. */
  fray?: number;
  /** Direction of the threads, in degrees. Default 25. */
  angle?: number;
  /** How much the outer threads fade, 0 (all equally bright) to 1. Default 0.85. */
  taper?: number;
  /** Brightness of the threads, 0.25 to 2. Default 1.4. */
  brightness?: number;
  /** How far the threads move aside around the cursor, 0 to 1. Default 0. */
  parting?: number;
  /** The cursor steers the waves: sideways shifts them, up and down changes their height. Default false. */
  enableMouseInteraction?: boolean;
  /** Fades the edges into the page, 0 to 1. Default 0. */
  fade?: number;
  /** Opacity of the whole effect. Default 1. */
  opacity?: number;
  /** Changes the wave pattern. Default 0. */
  seed?: number;
  /** Freezes the animation. Default false. */
  paused?: boolean;
}

type Vec3 = [number, number, number];

const MAX_RENDER_DIM = 1920;
const CONTAINER: CSSProperties = { position: "relative", width: "100%", height: "100%" };
const CANVAS: CSSProperties = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" };

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

const link = (gl: WebGL2RenderingContext, vertexSource: string, fragmentSource: string) => {
  const vertex = compile(gl, gl.VERTEX_SHADER, vertexSource);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (gl.getProgramParameter(program, gl.LINK_STATUS)) return program;
  gl.deleteProgram(program);
  return null;
};

const locate = (gl: WebGL2RenderingContext, program: WebGLProgram, names: string[]) => {
  const result: Record<string, WebGLUniformLocation | null> = {};
  for (const name of names) result[name] = gl.getUniformLocation(program, name);
  return result;
};

export function Threads({
  color = [1, 1, 1],
  accentColor,
  amplitude = 1.7,
  distance = 0.4,
  enableMouseInteraction = false,
  lineCount = 90,
  thickness = 0.6,
  softness = 1.3,
  speed = 0.6,
  waves = 1.05,
  split = 0.04,
  fray = 0.5,
  angle = 25,
  seed = 0,
  parting = 0,
  taper = 0.85,
  brightness = 1.4,
  fade = 0,
  opacity = 1,
  paused = false,
  className = "",
  style,
  ...rest
}: ThreadsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const colorKey = `${Array.isArray(color) ? color.join(",") : String(color)}|${
    Array.isArray(accentColor) ? accentColor.join(",") : String(accentColor ?? "")
  }`;
  const settings = {
    color,
    accentColor,
    colorKey,
    amplitude,
    distance,
    enableMouseInteraction,
    lineCount: clamp(Math.round(lineCount), 1, 400),
    thickness: Math.max(0, thickness),
    softness: Math.max(0, softness),
    speed,
    waves: Math.max(0, waves),
    split: clamp(split, 0, 1),
    fray: clamp(fray, 0, 1),
    angle,
    seed,
    parting: clamp(parting, 0, 1),
    taper: clamp(taper, 0, 1),
    brightness: clamp(brightness, 0.25, 2),
    fade: clamp(fade, 0, 1),
    opacity: clamp(opacity, 0, 1),
    paused,
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

    const lineProgram = link(gl, LINE_VERTEX, LINE_FRAGMENT);
    const screenProgram = link(gl, SCREEN_VERTEX, SCREEN_FRAGMENT);
    if (!lineProgram || !screenProgram) return undefined;

    const lineUniforms = locate(gl, lineProgram, [
      "uTime", "uResolution", "uFrame", "uAmplitude", "uDistance", "uMouse", "uCount", "uThickness", "uSoftness", "uWaves",
      "uSplit", "uFray", "uSeed", "uTurn", "uPart", "uTaper", "uColor", "uAccent",
    ]);
    const screenUniforms = locate(gl, screenProgram, ["uLines", "uResolution", "uFade", "uOpacity", "uCurve"]);

    const lineVao = gl.createVertexArray();
    const lineBuffer = gl.createBuffer();
    gl.bindVertexArray(lineVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
    const pointLocation = gl.getAttribLocation(lineProgram, "aPoint");
    gl.enableVertexAttribArray(pointLocation);
    gl.vertexAttribPointer(pointLocation, 2, gl.FLOAT, false, 0, 0);

    const screenVao = gl.createVertexArray();
    const screenBuffer = gl.createBuffer();
    gl.bindVertexArray(screenVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, screenBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const positionLocation = gl.getAttribLocation(screenProgram, "aPosition");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    const target = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, target);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const probeContext = probe.getContext("2d", { willReadFrequently: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const state = {
      time: 0,
      width: 1,
      height: 1,
      segments: 0,
      colorKey: "",
      color: [1, 1, 1] as Vec3,
      accent: [1, 1, 1] as Vec3,
      mouse: [0.5, 0.5],
      targetMouse: [0.5, 0.5],
      pointer: [0, 0],
      targetPointer: [0, 0],
      presence: 0,
      inside: false,
    };
    let raf = 0;
    let last = 0;
    let visible = true;
    let alive = true;

    const toRgb = (value: ThreadsColor): Vec3 => {
      if (Array.isArray(value)) return [0, 1, 2].map((i) => clamp(Number(value[i] ?? 1), 0, 1)) as Vec3;
      if (!probeContext) return [1, 1, 1];
      probeContext.clearRect(0, 0, 1, 1);
      probeContext.fillStyle = "#ffffff";
      probeContext.fillStyle = String(value);
      probeContext.fillRect(0, 0, 1, 1);
      const [r, g, b] = probeContext.getImageData(0, 0, 1, 1).data;
      return [r / 255, g / 255, b / 255];
    };

    const resolveColors = (s: typeof settings) => {
      if (s.colorKey === state.colorKey) return;
      state.colorKey = s.colorKey;
      state.color = toRgb(s.color);
      state.accent = s.accentColor === undefined || s.accentColor === null ? state.color : toRgb(s.accentColor);
    };

    const buildStrip = (segments: number) => {
      if (segments === state.segments) return;
      state.segments = segments;
      const points = new Float32Array((segments + 1) * 4);
      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        points.set([u, -1, u, 1], i * 4);
      }
      gl.bindBuffer(gl.ARRAY_BUFFER, lineBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, points, gl.STATIC_DRAW);
    };

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const baseDpr = Math.min(window.devicePixelRatio || 1, 2);
      const longest = Math.max(width, height) * baseDpr;
      const dpr = longest > MAX_RENDER_DIM ? (baseDpr * MAX_RENDER_DIM) / longest : baseDpr;
      canvas.width = Math.max(1, Math.round(width * dpr));
      canvas.height = Math.max(1, Math.round(height * dpr));
      state.width = width;
      state.height = height;
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      buildStrip(clamp(Math.round(width / 3), 96, 640));
      render();
    };

    const render = () => {
      const s = settingsRef.current;
      resolveColors(s);
      const w = canvas.width;
      const h = canvas.height;
      const radians = (s.angle * Math.PI) / 180;
      const cos = Math.cos(radians);
      const sin = Math.sin(radians);
      const length = Math.abs(w * cos) + Math.abs(h * sin);
      const across = Math.abs(w * sin) + Math.abs(h * cos);
      const scale = w / state.width;
      const mouse = s.enableMouseInteraction ? state.mouse : [0.5, 0.5];
      const strength = s.parting * state.presence * 2;
      const px = state.pointer[0] * scale;
      const py = state.pointer[1] * scale;
      const local = [px * cos + py * sin, -px * sin + py * cos];

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(lineProgram);
      gl.uniform1f(lineUniforms.uTime, state.time);
      gl.uniform2f(lineUniforms.uResolution, w, h);
      gl.uniform2f(lineUniforms.uFrame, length, across);
      gl.uniform1f(lineUniforms.uAmplitude, s.amplitude);
      gl.uniform1f(lineUniforms.uDistance, s.distance);
      gl.uniform2f(lineUniforms.uMouse, mouse[0], mouse[1]);
      gl.uniform1f(lineUniforms.uCount, s.lineCount);
      gl.uniform1f(lineUniforms.uThickness, s.thickness);
      gl.uniform1f(lineUniforms.uSoftness, s.softness);
      gl.uniform1f(lineUniforms.uWaves, s.waves);
      gl.uniform1f(lineUniforms.uSplit, s.split);
      gl.uniform1f(lineUniforms.uFray, s.fray);
      gl.uniform1f(lineUniforms.uSeed, s.seed * 13.37);
      gl.uniform2f(lineUniforms.uTurn, cos, sin);
      gl.uniform4f(lineUniforms.uPart, local[0], local[1], strength, Math.min(w, h) * 0.16);
      gl.uniform1f(lineUniforms.uTaper, s.taper);
      gl.uniform3f(lineUniforms.uColor, state.color[0], state.color[1], state.color[2]);
      gl.uniform3f(lineUniforms.uAccent, state.accent[0], state.accent[1], state.accent[2]);
      gl.bindVertexArray(lineVao);
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (state.segments + 1) * 2, s.lineCount);

      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, w, h);
      gl.disable(gl.BLEND);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(screenProgram);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, target);
      gl.uniform1i(screenUniforms.uLines, 0);
      gl.uniform2f(screenUniforms.uResolution, w, h);
      gl.uniform1f(screenUniforms.uFade, s.fade);
      gl.uniform1f(screenUniforms.uOpacity, s.opacity);
      gl.uniform1f(screenUniforms.uCurve, 2 / s.brightness);
      gl.bindVertexArray(screenVao);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindVertexArray(null);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!alive || !visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = !s.paused && !reduce;
      if (moving) state.time += dt * s.speed;
      const follow = 1 - Math.exp(-dt * 3);
      state.mouse[0] += (state.targetMouse[0] - state.mouse[0]) * follow;
      state.mouse[1] += (state.targetMouse[1] - state.mouse[1]) * follow;
      const glide = 1 - Math.exp(-dt * 10);
      state.pointer[0] += (state.targetPointer[0] - state.pointer[0]) * glide;
      state.pointer[1] += (state.targetPointer[1] - state.pointer[1]) * glide;
      state.presence += ((state.inside && s.parting > 0 ? 1 : 0) - state.presence) * (1 - Math.exp(-dt * 4));
      render();
      const settling =
        Math.abs(state.targetMouse[0] - state.mouse[0]) > 0.0005 ||
        Math.abs(state.targetMouse[1] - state.mouse[1]) > 0.0005 ||
        Math.abs(state.targetPointer[0] - state.pointer[0]) > 0.05 ||
        Math.abs(state.targetPointer[1] - state.pointer[1]) > 0.05 ||
        Math.abs((state.inside && s.parting > 0 ? 1 : 0) - state.presence) > 0.002;
      if (moving || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf && alive && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = (event.clientX - rect.left) / Math.max(1, rect.width);
      const y = (event.clientY - rect.top) / Math.max(1, rect.height);
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      if (inside) {
        state.targetMouse = [x, 1 - y];
        state.targetPointer = [event.clientX - rect.left - rect.width / 2, rect.height / 2 - (event.clientY - rect.top)];
        if (!state.inside && state.presence < 0.01) state.pointer = [...state.targetPointer];
      } else if (state.inside) {
        state.targetMouse = [0.5, 0.5];
      }
      state.inside = inside;
      wake();
    };

    const onPointerLeave = () => {
      state.inside = false;
      state.targetMouse = [0.5, 0.5];
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
    document.documentElement.addEventListener("pointerleave", onPointerLeave);
    document.addEventListener("visibilitychange", onVisibility);
    resize();

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
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(target);
      gl.deleteBuffer(lineBuffer);
      gl.deleteBuffer(screenBuffer);
      gl.deleteVertexArray(lineVao);
      gl.deleteVertexArray(screenVao);
      gl.deleteProgram(lineProgram);
      gl.deleteProgram(screenProgram);
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div ref={containerRef} className={`threads-container${className ? ` ${className}` : ""}`} style={{ ...CONTAINER, ...style }} {...rest}>
      <canvas ref={canvasRef} className="threads-canvas" style={CANVAS} aria-hidden="true" />
    </div>
  );
}

export default Threads;
