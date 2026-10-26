// Small WebGL2 helpers and GLSL snippets for the backgrounds. Optional: a background may hand-roll its own.
import { LUMINO_STOPS } from "../brand/brand.js";
import { brandmarkSDF, brandmarkCanvas, type MarkSDF } from "../brand/mark.js";

export interface Program {
  program: WebGLProgram;
  /** Every active uniform's location, by name (arrays as "name[0]"). */
  u: Record<string, WebGLUniformLocation | null>;
}

/** A vertex shader for one full-screen triangle (see drawFullscreen). vUv runs 0 to 1, y up. */
export const FULLSCREEN_VS = `#version 300 es
in vec2 aPosition;
out vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

function compile(gl: WebGL2RenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS) && !gl.isContextLost()) {
    const log = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`shader compile failed: ${log}`);
  }
  return shader;
}

/** Compile and link a program. The fragment shader alone is enough: the vertex shader defaults to FULLSCREEN_VS. Throws with the log on failure. */
export function link(gl: WebGL2RenderingContext, fragment: string, vertex = FULLSCREEN_VS): Program {
  const program = gl.createProgram()!;
  const vs = compile(gl, gl.VERTEX_SHADER, vertex), fs = compile(gl, gl.FRAGMENT_SHADER, fragment);
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.bindAttribLocation(program, 0, "aPosition");
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS) && !gl.isContextLost()) throw new Error(`program link failed: ${gl.getProgramInfoLog(program)}`);
  const u: Program["u"] = {};
  const n = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS) as number;
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    u[info.name] = gl.getUniformLocation(program, info.name);
    if (info.name.endsWith("[0]")) u[info.name.slice(0, -3)] = u[info.name]!;
  }
  return { program, u };
}

const triangles = new WeakMap<WebGL2RenderingContext, WebGLVertexArrayObject>();

/** Draw one triangle that covers the viewport, with attribute 0 as its position. */
export function drawFullscreen(gl: WebGL2RenderingContext) {
  let vao = triangles.get(gl);
  if (!vao) {
    vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    triangles.set(gl, vao);
  }
  gl.bindVertexArray(vao);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

/** A texture from a canvas or image, linear, clamped, with mipmaps unless `mipmaps` is false. */
export function canvasTexture(gl: WebGL2RenderingContext, source: TexImageSource, mipmaps = true): WebGLTexture {
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
  if (mipmaps) gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mipmaps ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** The brandmark's signed distance field as an R8 texture (see brandmarkSDF; sample .r, 0.5 is the edge). Flipped so uv (0,0) is bottom-left. */
export function markSDFTexture(gl: WebGL2RenderingContext, sdf: MarkSDF = brandmarkSDF()): WebGLTexture {
  const { data, width, height } = sdf;
  const flipped = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) flipped.set(data.subarray(y * width, (y + 1) * width), (height - 1 - y) * width);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, width, height, 0, gl.RED, gl.UNSIGNED_BYTE, flipped);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** The brandmark as an RGBA texture (white on transparent unless `fill` says otherwise), `size` square. */
export function markTexture(gl: WebGL2RenderingContext, size = 512, options?: Parameters<typeof brandmarkCanvas>[2]): WebGLTexture {
  return canvasTexture(gl, brandmarkCanvas(size, size, options));
}

/** A colour (#rgb, #rrggbb) as sRGB 0 to 1. */
export function rgb(hex: string): [number, number, number] {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * A 256 x 1 gradient texture from colour stops (default the brand's seven, stretched
 * to fill 0 to 1), for `texture(uPalette, vec2(t, 0.5))` or BRAND_GLSL's palette().
 */
export function paletteTexture(gl: WebGL2RenderingContext, stops: readonly (readonly [string, number])[] | readonly string[] = LUMINO_STOPS): WebGLTexture {
  const list = (stops as readonly (string | readonly [string, number])[]).map((s, i, a) =>
    typeof s === "string" ? ([s, a.length > 1 ? i / (a.length - 1) : 0] as const) : s,
  );
  const lo = list[0]![1], hi = list[list.length - 1]![1], span = hi - lo || 1;
  const pts = list.map(([c, p]) => [rgb(c), (p - lo) / span] as const);
  const px = new Uint8Array(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let j = 0;
    while (j < pts.length - 2 && t > pts[j + 1]![1]) j++;
    const [a, pa] = pts[j]!, [b, pb] = pts[Math.min(j + 1, pts.length - 1)]!;
    const k = pb > pa ? Math.max(0, Math.min(1, (t - pa) / (pb - pa))) : 0;
    for (let c = 0; c < 3; c++) px[i * 4 + c] = Math.round((a[c]! + (b[c]! - a[c]!) * k) * 255);
    px[i * 4 + 3] = 255;
  }
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, px);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}

/** Bind a texture to a unit and point a sampler uniform at it. */
export function bindTexture(gl: WebGL2RenderingContext, unit: number, tex: WebGLTexture | null, uniform: WebGLUniformLocation | null | undefined) {
  gl.activeTexture(gl.TEXTURE0 + unit);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  if (uniform) gl.uniform1i(uniform, unit);
}

/**
 * GLSL helpers to paste after `precision`: hash, value noise, fbm, the brand
 * palette (needs `uniform sampler2D uPalette`), the mark's SDF (needs
 * `uniform sampler2D uMark`) and ACES-ish tone mapping.
 *
 *   markSD(p): signed distance to the mark in mark-square units (negative inside),
 *              p in 0 to 1 of the square the SDF was baked in (y up).
 */
export const BRAND_GLSL = `
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
vec2 hash22(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p), u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = mat2(1.6, 1.2, -1.2, 1.6) * p; a *= 0.5; } return s; }
vec3 palette(float t) { return texture(uPalette, vec2(clamp(t, 0.0, 1.0), 0.5)).rgb; }
float markSD(vec2 p) {
  vec2 q = clamp(p, 0.0, 1.0);
  float d = -(texture(uMark, q).r - 0.5) * 2.0 * MARK_SPREAD;
  return d + length(p - q);
}
vec3 tonemap(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
`;

/** The `#define MARK_SPREAD` BRAND_GLSL's markSD needs: the SDF's spread as a share of its side. */
export function markSpreadDefine(sdf: MarkSDF): string {
  return `#define MARK_SPREAD ${(sdf.spread / sdf.width).toFixed(6)}\n`;
}
