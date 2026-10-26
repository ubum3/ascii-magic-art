import { BRAND_GLSL } from "../../backgrounds/gl.js";

/*
 * DitherLens: the brand light as a chunky ordered-dither field (4 x 4 Bayer over a
 * few palette steps), and a big brandmark of frosted glass that shows the same light
 * smooth, refracted and glowing, with a bright rim and a slow specular sweep.
 */
export const DITHER_LENS = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;      // dither cell in device pixels
uniform float uLevels;    // tone steps between the ground and the light
uniform vec3 uGround;
uniform vec4 uLens;       // centre x, y (aspect units), size, tilt
uniform vec2 uPointer;
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}

float bayer4(vec2 c) {
  ivec2 i = ivec2(mod(c, 4.0));
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i.y * 4 + i.x]) + 0.5) / 16.0;
}

// The light: drifting warm and cool clouds along the brand's 139deg, dark between them and quiet in the middle.
vec4 light(vec2 p, float aspect, float t) {
  vec2 q = p * 1.2 + vec2(t * 0.6, -t * 0.4);
  vec2 w = vec2(fbm(q + 3.1), fbm(q - 1.7 + t * 0.3));
  float f = fbm(p * 1.05 + w * 1.6 - vec2(0.0, t * 0.5));
  vec2 c = vec2(p.x / aspect, p.y) - 0.5;
  float calm = smoothstep(0.08, 0.6, length(c * vec2(1.0, 1.3)));
  float lum = pow(smoothstep(0.42, 0.9, f), 1.4) * (0.15 + 1.25 * calm);
  // Along the gradient's axis: warm low right, cool high left, nudged by the clouds.
  float axis = dot(vec2(p.x / aspect, p.y) - 0.5, normalize(vec2(-0.75, 0.66))) + 0.5;
  float hue = clamp(axis * 0.9 + (w.x - 0.5) * 0.5, 0.0, 1.0);
  return vec4(palette(hue), lum);
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 frag = gl_FragCoord.xy;
  float t = uTime * 0.045;

  // Dithered field: one sample per cell, quantised with a Bayer threshold.
  vec2 cell = floor(frag / uCell);
  vec2 cuv = (cell + 0.5) * uCell / uResolution;
  vec4 L = light(vec2(cuv.x * aspect, cuv.y), aspect, t);
  float level = floor(L.a * uLevels + bayer4(cell));
  vec3 col = mix(uGround, L.rgb * 1.25, clamp(level / uLevels, 0.0, 1.0));
  // Round the cells a touch, so the dither reads as pixels of light, not flat squares.
  vec2 inCell = fract(frag / uCell) - 0.5;
  col = mix(uGround, col, 1.0 - smoothstep(0.38, 0.5, max(abs(inCell.x), abs(inCell.y))) * 0.6);

  // The lens: the brandmark, tilted, as frosted glass.
  vec2 p = vec2(vUv.x * aspect, vUv.y);
  vec2 d = p - uLens.xy;
  float c = cos(uLens.w), s = sin(uLens.w);
  vec2 m = mat2(c, s, -s, c) * d / uLens.z + 0.5;
  float sd = markSD(m);
  if (sd < 0.02) {
    float e = 0.004;
    vec2 n = vec2(markSD(m + vec2(e, 0.0)) - markSD(m - vec2(e, 0.0)), markSD(m + vec2(0.0, e)) - markSD(m - vec2(0.0, e)));
    n = n / max(length(n), 1e-5);
    float depth = clamp(-sd / 0.05, 0.0, 1.0);          // 0 at the edge, 1 deep inside
    vec2 bend = -n * (1.0 - depth) * 0.06;               // refraction: stronger near the edges
    float frost = (vnoise(frag * 0.35) - 0.5) * 0.012;
    vec4 G = light(p + bend + frost, aspect, t);
    vec3 tint = palette(clamp(0.95 - (m.y * 0.75 + m.x * 0.35), 0.0, 1.0));      // the brand gradient across the mark
    vec3 glass = tint * (0.55 + 0.45 * fbm(m * 4.0 + t * 3.0)) * (0.55 + 0.6 * depth) + G.rgb * G.a * 2.2;
    float rim = exp(-abs(sd) * 260.0);
    float fres = pow(1.0 - depth, 3.0);
    float sweep = smoothstep(0.06, 0.0, abs(fract(uTime * 0.035) * 3.0 - 1.0 - (m.x + m.y * 0.6)));
    vec3 lens = glass + vec3(1.0, 0.92, 0.88) * (rim * 1.1 + fres * 0.45 + sweep * 0.5 * depth);
    float inside = 1.0 - smoothstep(-0.0015, 0.0015, sd);
    col = mix(col, lens, inside);
    // A soft light halo hugging the outside of the glass.
    col += palette(0.12 + m.y * 0.5) * (exp(-max(sd, 0.0) * 40.0) * 0.3 + exp(-max(sd, 0.0) * 9.0) * 0.12) * (1.0 - inside);
  } else {
    col += palette(0.12 + m.y * 0.5) * (exp(-sd * 40.0) * 0.3 + exp(-sd * 9.0) * 0.12);
  }

  col = tonemap(col * 1.15);
  col += (hash12(frag + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
