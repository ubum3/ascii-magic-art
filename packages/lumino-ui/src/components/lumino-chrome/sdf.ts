// A smooth, float copy of the brandmark's SDF, for shaders that take its gradient.
import type { MarkSDF } from "../../brand/mark.js";

/**
 * The SDF as floats in mark-square units (negative inside, like BRAND_GLSL's markSD),
 * box-blurred `passes` times with `radius` so the 8-bit steps don't show in a gradient.
 */
export function smoothMarkSDF(sdf: MarkSDF, radius = 2, passes = 2): Float32Array {
  const { data, width: w, height: h, spread } = sdf;
  let a = new Float32Array(w * h);
  for (let i = 0; i < a.length; i++) a[i] = -((data[i]! - 128) / 127) * (spread / w);
  let b = new Float32Array(w * h);
  const blur = (src: Float32Array, dst: Float32Array, stride: number, step: number, n: number, lines: number) => {
    for (let l = 0; l < lines; l++) {
      const o = l * stride;
      for (let i = 0; i < n; i++) {
        let s = 0;
        for (let k = -radius; k <= radius; k++) s += src[o + Math.max(0, Math.min(n - 1, i + k)) * step]!;
        dst[o + i * step] = s / (2 * radius + 1);
      }
    }
  };
  for (let p = 0; p < passes; p++) {
    blur(a, b, w, 1, w, h);
    blur(b, a, 1, w, h, w);
  }
  b = a;
  return b;
}

/** Upload a w x h float field as an R16F texture (filterable everywhere in WebGL2), flipped so uv (0,0) is bottom-left. */
export function floatFieldTexture(gl: WebGL2RenderingContext, field: Float32Array, w: number, h: number): WebGLTexture {
  const flipped = new Float32Array(field.length);
  for (let y = 0; y < h; y++) flipped.set(field.subarray(y * w, (y + 1) * w), (h - 1 - y) * w);
  const tex = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16F, w, h, 0, gl.RED, gl.FLOAT, flipped);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return tex;
}
