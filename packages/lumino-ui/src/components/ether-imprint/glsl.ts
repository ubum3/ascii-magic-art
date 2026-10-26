import { BRAND_GLSL } from "../../backgrounds/gl.js";

// The passes of a small stable-fluids solver (after Jos Stam, and Pavel Dobryakov's
// WebGL fluid), plus the brandmark imprint and a glassy display pass.

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 vUv;
out vec4 outColor;
`;

/** Move a field along the velocity, fading it by `uDissipation` per second. */
export const ADVECT = `${HEAD}
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uSimTexel;
uniform float uDt;
uniform float uDissipation;
void main() {
  vec2 coord = vUv - uDt * texture(uVelocity, vUv).xy * uSimTexel;
  outColor = textureLod(uSource, coord, 0.0) / (1.0 + uDissipation * uDt);
}`;

const NEIGHBOURS = `
uniform vec2 uTexel;
vec4 L(sampler2D s) { return texture(s, vUv - vec2(uTexel.x, 0.0)); }
vec4 R(sampler2D s) { return texture(s, vUv + vec2(uTexel.x, 0.0)); }
vec4 B(sampler2D s) { return texture(s, vUv - vec2(0.0, uTexel.y)); }
vec4 T(sampler2D s) { return texture(s, vUv + vec2(0.0, uTexel.y)); }
`;

export const DIVERGENCE = `${HEAD}${NEIGHBOURS}
uniform sampler2D uVelocity;
void main() {
  vec2 c = texture(uVelocity, vUv).xy;
  // Walls: the velocity into an edge is mirrored.
  float l = vUv.x - uTexel.x < 0.0 ? -c.x : L(uVelocity).x;
  float r = vUv.x + uTexel.x > 1.0 ? -c.x : R(uVelocity).x;
  float b = vUv.y - uTexel.y < 0.0 ? -c.y : B(uVelocity).y;
  float t = vUv.y + uTexel.y > 1.0 ? -c.y : T(uVelocity).y;
  outColor = vec4(0.5 * (r - l + t - b), 0.0, 0.0, 1.0);
}`;

export const CURL = `${HEAD}${NEIGHBOURS}
uniform sampler2D uVelocity;
void main() {
  outColor = vec4(0.5 * (R(uVelocity).y - L(uVelocity).y - T(uVelocity).x + B(uVelocity).x), 0.0, 0.0, 1.0);
}`;

/** Vorticity confinement: puts back the small swirls the solver smooths away. */
export const VORTICITY = `${HEAD}${NEIGHBOURS}
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform float uCurlStrength;
uniform float uDt;
void main() {
  float c = texture(uCurl, vUv).x;
  vec2 f = 0.5 * vec2(abs(T(uCurl).x) - abs(B(uCurl).x), abs(R(uCurl).x) - abs(L(uCurl).x));
  f = f / (length(f) + 1e-4) * uCurlStrength * c;
  f.y = -f.y;
  vec2 v = texture(uVelocity, vUv).xy + f * uDt;
  outColor = vec4(clamp(v, -1000.0, 1000.0), 0.0, 1.0);
}`;

export const PRESSURE = `${HEAD}${NEIGHBOURS}
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
void main() {
  float p = L(uPressure).x + R(uPressure).x + B(uPressure).x + T(uPressure).x;
  outColor = vec4((p - texture(uDivergence, vUv).x) * 0.25, 0.0, 0.0, 1.0);
}`;

export const GRADIENT = `${HEAD}${NEIGHBOURS}
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
void main() {
  vec2 v = texture(uVelocity, vUv).xy - vec2(R(uPressure).x - L(uPressure).x, T(uPressure).x - B(uPressure).x);
  outColor = vec4(v, 0.0, 1.0);
}`;

/** Scale a field (pressure carried over between frames). */
export const SCALE = `${HEAD}
uniform sampler2D uSource;
uniform float uScale;
void main() { outColor = texture(uSource, vUv) * uScale; }`;

/** A soft round splat added to a field. */
export const SPLAT = `${HEAD}
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec2 uPoint;
uniform vec3 uColor;
uniform float uRadius;
void main() {
  vec2 d = vUv - uPoint;
  d.x *= uAspect;
  outColor = vec4(texture(uTarget, vUv).rgb + exp(-dot(d, d) / uRadius) * uColor, 1.0);
}`;

/**
 * The brandmark stamped into a field. For dye, its fill in brand colours (running
 * through the gradient from tip to feet); for velocity, a push out of the strokes along
 * the distance field's slope with a turn to one side, so it blooms and curls apart.
 */
export const IMPRINT = (spread: string) => `${HEAD}
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uMarkAt;    // centre x, y (uv, x stretched by aspect) and square side (in uv height)
uniform float uAmount;
uniform float uHue;      // where on the gradient this imprint starts
uniform float uVelocityPass;
uniform float uTurn;     // -1 or 1: which way it curls
${BRAND_GLSL}
void main() {
  vec2 p = vec2(vUv.x * uAspect, vUv.y);
  vec2 m = (p - vec2(uMarkAt.x * uAspect, uMarkAt.y)) / uMarkAt.z + 0.5;
  float d = markSD(m);
  vec4 base = texture(uTarget, vUv);
  if (uVelocityPass > 0.5) {
    float e = 0.004;
    vec2 g = vec2(markSD(m + vec2(e, 0.0)) - markSD(m - vec2(e, 0.0)), markSD(m + vec2(0.0, e)) - markSD(m - vec2(0.0, e)));
    g /= length(g) + 1e-5;
    float band = exp(-abs(d) * 60.0);
    vec2 push = (g + vec2(-g.y, g.x) * uTurn * 0.6) * band;
    outColor = vec4(base.xy + push * uAmount, 0.0, 1.0);
  } else {
    float inside = 1.0 - smoothstep(-0.003, 0.003, d);
    float halo = exp(-max(d, 0.0) * 50.0) * 0.25;
    vec3 c = palette(fract(uHue + clamp(0.9 - m.y, 0.0, 1.0) * 0.5 + m.x * 0.12));
    outColor = vec4(base.rgb + c * (inside + halo) * uAmount, 1.0);
  }
}`;

/** Copy a field into a new size (on resize). */
export const COPY = `${HEAD}
uniform sampler2D uSource;
void main() { outColor = texture(uSource, vUv); }`;

/**
 * The dye shown as luminous glass: its own colour, a sheen from its slopes (as if the
 * dye were a thin glass layer catching a light from the top left), a wide bloom from
 * the blurred mips, all over the near-black ground.
 */
export const DISPLAY = `${HEAD}
uniform sampler2D uDye;
uniform vec2 uDyeTexel;
uniform float uTime;
vec3 tonemap(vec3 x) { return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0); }
float hash12(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
void main() {
  vec3 c = textureLod(uDye, vUv, 0.0).rgb;
  float lc = dot(c, vec3(0.3, 0.5, 0.2));
  vec2 o = uDyeTexel * 2.0;
  float lx = dot(textureLod(uDye, vUv + vec2(o.x, 0.0), 0.0).rgb - textureLod(uDye, vUv - vec2(o.x, 0.0), 0.0).rgb, vec3(0.3, 0.5, 0.2));
  float ly = dot(textureLod(uDye, vUv + vec2(0.0, o.y), 0.0).rgb - textureLod(uDye, vUv - vec2(0.0, o.y), 0.0).rgb, vec3(0.3, 0.5, 0.2));
  vec3 n = normalize(vec3(-lx, -ly, 0.12));
  vec3 h = normalize(vec3(-0.45, 0.55, 1.0) + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, h), 0.0), 40.0) * smoothstep(0.02, 0.25, lc);
  vec3 bloom = textureLod(uDye, vUv, 3.0).rgb * 0.45 + textureLod(uDye, vUv, 5.0).rgb * 0.35;
  vec3 col = vec3(0.045, 0.04, 0.05) + c * 0.9 + bloom + vec3(1.0, 0.93, 0.9) * spec * 0.45;
  col = tonemap(col);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
