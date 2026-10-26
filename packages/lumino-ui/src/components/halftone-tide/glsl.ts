import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * A fine grid of round dots on the ground, swelling and brightening under slow
 * blobs of brand light, over a soft blurred glow of the same light. The
 * brandmark surfaces in the dots (larger, brighter, a crisp edge row) and a
 * bright tide sweeps through it every `uTideEvery` seconds.
 *
 * Units: `css` is the pixel in CSS pixels (the dot grid lives here, so spacing
 * stays the same at any DPR or quality); `p` is the same point in box-height
 * units (the light and the mark live here, so they scale with the box).
 */
export const TIDE = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform vec2 uCss;          // the box in CSS pixels
uniform float uCssPerPx;    // CSS pixels per device pixel (cssWidth / width)
uniform float uTime;
uniform float uSpacing;     // dot pitch, CSS pixels
uniform float uHex;         // 1 hex grid, 0 square grid
uniform float uTideEvery;   // seconds between tides through the mark
uniform vec3 uPointer;      // xy in CSS pixels, z how much it is over the box (eased)
uniform vec4 uMarkBox;      // the mark's square: centre xy and side, in box-height units
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
const vec3 GROUND = vec3(0.0667, 0.0627, 0.0745);

// Cheap 3-octave noise for the light (the shared fbm has 5; this runs twice a pixel).
float fbm3(vec2 p) {
  float s = 0.5 * vnoise(p);
  p = mat2(1.6, 1.2, -1.2, 1.6) * p; s += 0.25 * vnoise(p);
  p = mat2(1.6, 1.2, -1.2, 1.6) * p; s += 0.125 * vnoise(p);
  return s / 0.875;
}

// One blob of light: a soft gaussian drifting on a slow Lissajous path.
// Returns its weight at p; its hue (palette position) goes to the caller.
float blob(vec2 p, vec2 base, vec2 amp, vec2 freq, float phase, float size, float t) {
  vec2 c = base + amp * vec2(sin(t * freq.x + phase), cos(t * freq.y + phase * 1.7));
  vec2 d = p - c;
  return exp(-dot(d, d) / (size * size));
}

// The light field at p (box-height units): x = intensity 0..1, y = palette position.
// Warm blobs (peach, coral), cool blobs (blue, lavender); where they thin out the
// colour falls toward plum and indigo, so the in-between reads as the gradient's middle.
vec2 light(vec2 p, float aspect, float t) {
  // A slow domain warp makes the blobs into nebula wisps rather than discs.
  vec2 w = vec2(fbm3(p * 1.3 + vec2(t * 0.11, -t * 0.07)), fbm3(p * 1.3 + vec2(-t * 0.09, t * 0.08) + 7.3)) - 0.5;
  vec2 q = p + w * 0.45;
  float A = aspect;
  float b0 = blob(q, vec2(0.16 * A, 0.20), vec2(0.18 * A, 0.14), vec2(0.13, 0.10), 0.0, 0.34, t);   // peach
  float b1 = blob(q, vec2(0.45 * A, 0.06), vec2(0.30 * A, 0.10), vec2(0.09, 0.14), 2.1, 0.28, t);   // coral
  float b2 = blob(q, vec2(0.86 * A, 0.84), vec2(0.16 * A, 0.16), vec2(0.11, 0.08), 4.0, 0.36, t);   // blue
  float b3 = blob(q, vec2(0.60 * A, 0.98), vec2(0.30 * A, 0.08), vec2(0.07, 0.12), 1.3, 0.26, t);   // lavender
  float b4 = blob(q, vec2(0.94 * A, 0.22), vec2(0.10 * A, 0.18), vec2(0.10, 0.09), 5.2, 0.30, t);   // coral-wine
  float b5 = blob(q, vec2(0.08 * A, 0.86), vec2(0.12 * A, 0.12), vec2(0.08, 0.11), 3.3, 0.30, t);   // indigo-blue
  float sum = b0 + b1 + b2 + b3 + b4 + b5;
  float hue = (b0 * 0.05 + b1 * 0.26 + b2 * 0.80 + b3 * 0.88 + b4 * 0.32 + b5 * 0.74) / max(sum, 1e-3);
  // Wispy brightness inside the blobs, then a soft ceiling so overlaps don't blow out.
  float I = 1.0 - exp(-1.9 * sum * (0.45 + 0.9 * fbm3(q * 2.6 - t * 0.05)));
  // Thin light shifts toward the plum/indigo middle of the gradient.
  hue = mix(0.55, hue, smoothstep(0.05, 0.5, I));
  return vec2(I, hue);
}

void main() {
  float aspect = uCss.x / uCss.y;
  vec2 css = gl_FragCoord.xy * uCssPerPx;
  float t = uTime;
  float S = uSpacing;

  // ---- The dot cell: nearest lattice point, in CSS pixels.
  vec2 g;
  if (uHex > 0.5) {
    // Hex: two rectangular lattices, the second offset by half a cell; take the nearer centre.
    vec2 r = vec2(S, S * 1.7320508), h = r * 0.5;
    vec2 a = mod(css, r) - h, b = mod(css - h, r) - h;
    g = dot(a, a) < dot(b, b) ? a : b;
  } else {
    g = mod(css, vec2(S)) - 0.5 * S;
  }
  vec2 cell = css - g;                 // dot centre, CSS px
  float dist = length(g);              // pixel to dot centre, CSS px
  vec2 pc = cell / uCss.y;             // dot centre in box-height units
  vec2 pp = css / uCss.y;              // pixel in box-height units

  // ---- Calm middle: a centred card goes there, so the light thins out toward it.
  vec2 mid = (vUv - 0.5) * vec2(aspect, 1.0);
  float calm = mix(0.22, 1.0, smoothstep(0.10, 0.62, length(mid * vec2(0.75, 1.0))));
  vec2 cm = (pc / vec2(aspect, 1.0) - 0.5) * vec2(aspect, 1.0);
  float calmC = mix(0.22, 1.0, smoothstep(0.10, 0.62, length(cm * vec2(0.75, 1.0))));

  // ---- Light at the dot (one value per dot, so each dot is flat-coloured) and at the pixel (the glow).
  vec2 Lc = light(pc, aspect, t * 0.6);
  vec2 Lp = light(pp, aspect, t * 0.6);
  float Ic = Lc.x * calmC, Ip = Lp.x * calm;

  // ---- The mark, sampled at the dot centre so it is drawn in whole dots.
  vec2 m = (pc - uMarkBox.xy) / uMarkBox.z + 0.5;
  float d = markSD(m);                       // mark-square units, negative inside
  float cellD = S / (uMarkBox.z * uCss.y);   // one dot pitch in mark-square units
  float inside = step(d, 0.0);
  float edgeRow = inside * step(-0.95 * cellD, d);

  // The tide: every uTideEvery s a bright front crosses the mark (lower-left to upper-right),
  // leaves it fully lit, and the light ebbs back over a few seconds.
  float since = mod(t + uTideEvery * 0.55, uTideEvery);       // seconds into this tide
  float arrive = 0.3 + 1.6 * clamp(m.x * 0.6 + m.y * 0.4, 0.0, 1.0);
  float st = since - arrive;
  float front = exp(-st * st / 0.06);                          // the bright leading edge
  float lit = smoothstep(-0.15, 0.25, st) * exp(-max(st, 0.0) / 2.2);
  float tide = clamp(front * 0.9 + lit * 0.75, 0.0, 1.2);

  // ---- Pointer: swell the dots near it.
  vec2 dp = cell - uPointer.xy;
  float near = uPointer.z * exp(-dot(dp, dp) / (140.0 * 140.0));

  // ---- Dot size and brightness from the light, the mark and the pointer.
  // Dark ground keeps pinprick dots; under the light they swell toward touching.
  float I = clamp(Ic + near * 0.4, 0.0, 1.0);
  float swell = pow(I, 1.5);
  float rad = S * (0.07 + 0.33 * swell);
  // In the mark: a step larger, the edge row larger still, and the tide swells it fully.
  rad += S * inside * (0.07 + 0.04 * edgeRow + 0.10 * tide) + S * 0.05 * near;
  rad = min(rad, S * 0.46);

  // Colour by the light under the dot; in the mark it leans warm, and the tide pulls it to peach.
  float hue = mix(Lc.y, 0.1, inside * (0.2 + 0.7 * min(tide, 1.0)));
  vec3 tint = palette(hue);
  float bright = 0.13 + 0.95 * swell;
  bright += inside * (0.14 + 0.22 * edgeRow + 0.5 * tide);
  bright = min(bright, 1.05);

  // Antialiased disc (one device pixel of edge), with a hot core so each dot reads as a bead of glass.
  float aa = max(uCssPerPx, 0.5);
  float disc = clamp((rad - dist) / aa + 0.5, 0.0, 1.0);
  float k = clamp(dist / max(rad, 1e-3), 0.0, 1.0);
  vec3 dotCol = tint * bright * (0.8 + 0.55 * (1.0 - k * k));

  // ---- The glow underlay: the same light, blurred, seen through the gaps between dots.
  vec3 glow = palette(Lp.y) * pow(Ip, 1.3) * 0.42;
  // A wide hint of the mark in the glow too, brightest during the tide.
  float markGlow = exp(-max(markSD((pp - uMarkBox.xy) / uMarkBox.z + 0.5), 0.0) * 9.0);
  float tideAll = smoothstep(0.2, 1.2, since) * exp(-max(since - 1.2, 0.0) / 2.2);
  glow += palette(0.12) * markGlow * (0.03 + 0.09 * tideAll);

  // Light adds onto the ground, so where there is none the ground stays exactly #111013.
  vec3 shine = mix(glow, dotCol, disc);
  vec3 col = GROUND + (1.0 - GROUND) * clamp(shine, 0.0, 1.0);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
