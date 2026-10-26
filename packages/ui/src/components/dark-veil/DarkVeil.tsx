"use client";
/*
 * DarkVeil, from React Bits (reactbits.dev, MIT + Commons Clause): a soft, glowing
 * veil drawn with WebGL2 that swirls and lights up around the cursor. Ported to
 * TypeScript; the CSS file is inlined as styles, since this package ships no CSS.
 * It fills its container, so give the container a size.
 */
import { useEffect, useRef, type CSSProperties, type HTMLAttributes } from "react";
import { QUAD_VERTEX, FIELD, COMPOSITE } from "./glsl.js";

export interface DarkVeilProps extends Omit<HTMLAttributes<HTMLDivElement>, "color"> {
  /** Colour of the veil. Highlights are derived from it. Default #6b12ff. */
  color?: string;
  /** Animation speed. Default 0.5. */
  speed?: number;
  /** Zoom of the veil. Higher values zoom in. Default 1. */
  scale?: number;
  /** Turns the veil around the centre, in degrees. Default 0. */
  rotation?: number;
  /** How much the veil drifts and changes shape over time. Default 1. */
  flow?: number;
  /** Adds a gentle ripple to the veil. Default 0. */
  warp?: number;
  /** Picks a different veil shape. Any number works. Default 0. */
  variation?: number;
  /** Overall brightness. Default 1. */
  brightness?: number;
  /** Silky highlights along the folds that follow the cursor like a light. Default 0. */
  sheen?: number;
  /** Soft glow around the brightest parts. Default 0.4. */
  glow?: number;
  /** Strength of the film grain. Default 0.03. */
  grain?: number;
  /** Render resolution, 0.25 to 1. The veil is soft, so lower looks almost the same and runs faster. Default 0.5. */
  quality?: number;
  /** The veil swirls, morphs and lights up around the cursor. Default true. */
  mouseInteraction?: boolean;
  /** How strongly the cursor bends the veil. Default 1. */
  mouseStrength?: number;
  /** Fades the veil in as it unfolds. Default true. */
  intro?: boolean;
  /** Fades the edges into the page, 0 to 1. Default 0. */
  fade?: number;
  /** Opacity of the whole effect. Default 1. */
  opacity?: number;
  /** Draws the veil as soft tinted ink for light backgrounds. Default false. */
  lightMode?: boolean;
  /** Freezes the animation. Default false. */
  paused?: boolean;
  /** Maximum device pixel ratio, capped at 2. Default: the screen's. */
  dpr?: number;
}

type Program = { program: WebGLProgram; uniforms: Record<string, WebGLUniformLocation | null> };

const INTRO_SECONDS = 1.8;
const MAX_FIELD_PIXELS = 900000;
const CONTAINER: CSSProperties = { position: "relative", width: "100%", height: "100%", overflow: "hidden" };
const CANVAS: CSSProperties = { position: "absolute", inset: 0, display: "block", width: "100%", height: "100%" };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const variationOffsets = (variation: number): [number, number, number] => {
  const n = Number(variation) || 0;
  if (!n) return [0, 0, 0];
  const wave = (k: number) => {
    const v = Math.sin(n * 12.9898 + k * 78.233) * 43758.5453;
    return v - Math.floor(v) - 0.5;
  };
  return [wave(1), wave(2), wave(3)];
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

const link = (gl: WebGL2RenderingContext, fragmentSource: string): Program | null => {
  const vertex = compile(gl, gl.VERTEX_SHADER, QUAD_VERTEX);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, fragmentSource);
  const program = gl.createProgram();
  if (!vertex || !fragment || !program) return null;
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }
  const uniforms: Program["uniforms"] = {};
  const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
  }
  return { program, uniforms };
};

export function DarkVeil({
  color = "#6b12ff",
  speed = 0.5,
  scale = 1,
  rotation = 0,
  flow = 1,
  warp = 0,
  variation = 0,
  brightness = 1,
  sheen = 0,
  glow = 0.4,
  grain = 0.03,
  quality = 0.5,
  mouseInteraction = true,
  mouseStrength = 1,
  intro = true,
  fade = 0,
  opacity = 1,
  lightMode = false,
  paused = false,
  dpr,
  className = "",
  style,
  ...rest
}: DarkVeilProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wakeRef = useRef<(() => void) | null>(null);
  const settings = {
    color: String(color),
    speed,
    scale: Math.max(0.1, scale),
    rotation,
    flow: Math.max(0, flow),
    warp: Math.max(0, warp),
    variation,
    brightness: Math.max(0, brightness),
    sheen: Math.max(0, sheen),
    glow: Math.max(0, glow),
    grain: Math.max(0, grain),
    quality: clamp(quality, 0.25, 1),
    mouseInteraction,
    mouseStrength: Math.max(0, mouseStrength),
    intro,
    fade: clamp(fade, 0, 1),
    opacity: clamp(opacity, 0, 1),
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
      powerPreference: "high-performance",
    });
    if (!container || !canvas || !gl) return undefined;

    const floatTargets = !!gl.getExtension("EXT_color_buffer_float");
    const fieldProgram = link(gl, FIELD);
    const compositeProgram = link(gl, COMPOSITE);
    if (!fieldProgram || !compositeProgram) return undefined;

    const buffer = gl.createBuffer();
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    // texStorage2D storage is immutable, so a resize needs a fresh texture.
    let texture = gl.createTexture();
    const framebuffer = gl.createFramebuffer();
    const target = { width: 0, height: 0 };
    const sizeTarget = (width: number, height: number) => {
      if (target.width === width && target.height === height) return;
      target.width = width;
      target.height = height;
      gl.deleteTexture(texture);
      texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const levels = Math.floor(Math.log2(Math.max(width, height))) + 1;
      gl.texStorage2D(gl.TEXTURE_2D, levels, floatTargets ? gl.RGBA16F : gl.RGBA8, width, height);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    };

    const probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const colorCache = new Map<string, number[]>();
    const toLinear = (value: string) => {
      const cached = colorCache.get(value);
      if (cached) return cached;
      let rgb = [1, 1, 1];
      if (probe) {
        probe.clearRect(0, 0, 1, 1);
        probe.fillStyle = "#ffffff";
        probe.fillStyle = value;
        probe.fillRect(0, 0, 1, 1);
        const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
        rgb = [r, g, b].map((v) => Math.pow(v / 255, 2.2));
      }
      colorCache.set(value, rgb);
      return rgb;
    };

    const view = { width: 1, height: 1, fieldWidth: 1, fieldHeight: 1 };
    const pointer = { x: 0, y: 0, inside: false };
    const state = {
      clock: 0,
      intro: settingsRef.current.intro && !reduce ? 0 : 1,
      touch: 0,
      x: 0,
      y: 0,
      dragX: 0,
      dragY: 0,
      lightX: 0.5,
      lightY: 0.15,
    };
    let raf = 0;
    let last = 0;
    let visible = true;

    const render = () => {
      const s = settingsRef.current;
      const presence = state.intro * state.intro * state.intro * (state.intro * (state.intro * 6 - 15) + 10);
      gl.bindVertexArray(vao);
      sizeTarget(view.fieldWidth, view.fieldHeight);

      const f = fieldProgram.uniforms;
      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, target.width, target.height);
      gl.useProgram(fieldProgram.program);
      const angle = (s.rotation * Math.PI) / 180;
      const [sx, sy, sz] = variationOffsets(s.variation);
      gl.uniform2f(f.uView, view.width, view.height);
      gl.uniform2f(f.uScale, view.width / target.width, view.height / target.height);
      gl.uniform1f(f.uZoom, s.scale);
      gl.uniform2f(f.uTurn, Math.cos(angle), Math.sin(angle));
      gl.uniform1f(f.uTime, state.clock);
      gl.uniform1f(f.uFlow, s.flow);
      gl.uniform1f(f.uWarp, s.warp);
      gl.uniform3f(f.uSeed, 0.3948333106474662 + sx, 0.36 + sy, 0.14 + sz);
      gl.uniform4f(f.uPointer, state.x, state.y, state.touch * s.mouseStrength * 0.9, 0.42);
      gl.uniform2f(f.uDrag, (state.dragX * 2) / view.height, (state.dragY * 2) / view.height);
      gl.uniform1f(f.uUnfold, (1 - presence) * 0.45);
      gl.uniform1f(f.uDither, floatTargets ? 0 : 1 / 255);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.generateMipmap(gl.TEXTURE_2D);

      const c = compositeProgram.uniforms;
      const tint = toLinear(s.color);
      const tone = 0.2126 * tint[0] + 0.7152 * tint[1] + 0.0722 * tint[2];
      const depth = Math.min(1, 0.2 / Math.max(tone, 0.001));
      const ink = tint.map((v) => Math.pow(Math.min(1, v * depth), 1 / 2.2));
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(compositeProgram.program);
      gl.uniform2f(c.uResolution, canvas.width, canvas.height);
      gl.uniform2f(c.uTexel, 1 / target.width, 1 / target.height);
      gl.uniform3fv(c.uColor, tint);
      gl.uniform3fv(c.uInk, ink);
      gl.uniform1f(c.uGain, 1.15 * s.brightness);
      gl.uniform1f(c.uSheen, 0.5 * s.sheen);
      gl.uniform1f(c.uGlow, s.glow);
      gl.uniform1f(c.uPresence, presence);
      gl.uniform1f(c.uGrain, s.grain);
      gl.uniform1f(c.uFade, s.fade);
      gl.uniform1f(c.uOpacity, s.opacity);
      gl.uniform1f(c.uTime, state.clock % 1000);
      gl.uniform1f(c.uLightMode, s.lightMode ? 1 : 0);
      gl.uniform4f(c.uLight, (state.lightX * view.width) / view.height, 1 - state.lightY, state.touch * s.mouseStrength, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(c.uField, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const frame = (now: number) => {
      raf = 0;
      if (!visible || document.hidden) return;
      const s = settingsRef.current;
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 1 / 60;
      last = now;
      const moving = !s.paused && !reduce;
      if (moving) state.clock += dt * s.speed;
      if (!s.intro || reduce) state.intro = 1;
      else if (state.intro < 1) state.intro = Math.min(1, state.intro + dt / INTRO_SECONDS);

      const engaged = s.mouseInteraction && pointer.inside && !reduce;
      if (engaged && state.touch < 0.01) {
        state.x = pointer.x;
        state.y = pointer.y;
      }
      const follow = 1 - Math.exp(-dt * 9);
      const prevX = state.x;
      const prevY = state.y;
      state.x += (pointer.x - state.x) * follow;
      state.y += (pointer.y - state.y) * follow;
      const velX = (state.x - prevX) / Math.max(dt, 0.001);
      const velY = (state.y - prevY) / Math.max(dt, 0.001);
      const dragBlend = 1 - Math.exp(-dt * 5);
      state.dragX += (clamp(velX * 0.12, -120, 120) - state.dragX) * dragBlend;
      state.dragY += (clamp(-velY * 0.12, -120, 120) - state.dragY) * dragBlend;
      state.touch += ((engaged ? 1 : 0) - state.touch) * (1 - Math.exp(-dt * (engaged ? 3 : 1.6)));
      const lightGoalX = engaged ? pointer.x / view.width : 0.5;
      const lightGoalY = engaged ? pointer.y / view.height : 0.15;
      const lightFollow = 1 - Math.exp(-dt * 4);
      state.lightX += (lightGoalX - state.lightX) * lightFollow;
      state.lightY += (lightGoalY - state.lightY) * lightFollow;
      render();

      const settling =
        state.intro < 1 ||
        Math.abs((engaged ? 1 : 0) - state.touch) > 0.002 ||
        Math.abs(state.dragX) + Math.abs(state.dragY) > 0.05 ||
        Math.abs(pointer.x - state.x) + Math.abs(pointer.y - state.y) > 0.3 ||
        Math.abs(lightGoalX - state.lightX) + Math.abs(lightGoalY - state.lightY) > 0.0005;
      if (moving || settling) raf = requestAnimationFrame(frame);
      else last = 0;
    };

    const wake = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame);
    };

    const resize = () => {
      const s = settingsRef.current;
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      const ratio = Math.min(s.dpr || window.devicePixelRatio || 1, 2);
      view.width = width;
      view.height = height;
      canvas.width = Math.max(1, Math.round(width * ratio));
      canvas.height = Math.max(1, Math.round(height * ratio));
      let fieldScale = s.quality;
      if (width * height * fieldScale * fieldScale > MAX_FIELD_PIXELS) {
        fieldScale = Math.sqrt(MAX_FIELD_PIXELS / (width * height));
      }
      view.fieldWidth = Math.max(1, Math.round(width * fieldScale));
      view.fieldHeight = Math.max(1, Math.round(height * fieldScale));
      if (!raf) render();
      wake();
    };

    const onPointerMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      pointer.x = event.clientX - rect.left;
      pointer.y = event.clientY - rect.top;
      pointer.inside = pointer.x >= 0 && pointer.y >= 0 && pointer.x <= rect.width && pointer.y <= rect.height;
      wake();
    };

    const onPointerLeave = () => {
      pointer.inside = false;
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

    let lastQuality = settingsRef.current.quality;
    let lastDpr = settingsRef.current.dpr;
    wakeRef.current = () => {
      const s = settingsRef.current;
      if (s.quality !== lastQuality || s.dpr !== lastDpr) {
        lastQuality = s.quality;
        lastDpr = s.dpr;
        resize();
        return;
      }
      if (!raf) render();
      wake();
    };

    return () => {
      cancelAnimationFrame(raf);
      wakeRef.current = null;
      resizeObserver.disconnect();
      intersection.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("pointerleave", onPointerLeave);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteTexture(texture);
      gl.deleteFramebuffer(framebuffer);
      gl.deleteProgram(fieldProgram.program);
      gl.deleteProgram(compositeProgram.program);
      gl.deleteBuffer(buffer);
      gl.deleteVertexArray(vao);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
  }, []);

  useEffect(() => {
    wakeRef.current?.();
  });

  return (
    <div ref={containerRef} className={`dark-veil-container${className ? ` ${className}` : ""}`} style={{ ...CONTAINER, ...style }} {...rest}>
      <canvas ref={canvasRef} className="dark-veil-canvas" style={CANVAS} aria-hidden="true" />
    </div>
  );
}

export default DarkVeil;
