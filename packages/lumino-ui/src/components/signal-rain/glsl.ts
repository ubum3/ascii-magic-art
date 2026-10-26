import { BRAND_GLSL } from "../../backgrounds/gl.js";

/**
 * Signal rain: three parallax layers of falling monospace glyphs, drawn from a glyph
 * atlas, cool and dim on the ground. A large brandmark sits off-centre as a signed
 * distance field: glyphs whose cell centre passes inside it ignite warm (peach to
 * coral), with a halo just outside the edge, so the rain draws the mark. Every cell's
 * glyph, fall offset and brightness come from hashes of the cell and time; one pass.
 */
export const RAIN = (spread: string) => `#version 300 es
precision highp float;
${spread}
uniform sampler2D uPalette;
uniform sampler2D uMark;
uniform sampler2D uAtlas;
uniform vec2 uResolution;
uniform float uTime;
uniform float uCell;     // mid-layer cell size, device pixels
uniform float uDensity;  // share of cells holding a glyph
uniform float uGlyphs;   // common glyphs in the atlas (slots 0 .. uGlyphs-1)
uniform float uAccent;   // 1 if slot uGlyphs holds the rare accent glyph
uniform float uSlots;    // atlas slots across
uniform float uGlow;     // bloom strength
uniform vec2 uParallax;  // pointer offset, device pixels at the near layer
in vec2 vUv;
out vec4 outColor;
${BRAND_GLSL}
vec4 hash42(vec2 p) { return vec4(hash22(p), hash22(p.yx + 19.19)); }

// Where the mark sits: right of centre and partly off the edge on wide boxes, low on tall ones.
vec2 gMarkC;
float gMarkS;
// The warm ends of the gradient, looked up once per pixel rather than once per layer.
vec3 gCoral, gPeach;
vec2 markUV(vec2 px) { return (px / uResolution.y - gMarkC) / gMarkS + 0.5; }

/*
 * One layer of rain at this pixel. cell: cell size in device px; speed: cells a second;
 * blur: extra atlas mip levels (depth of field); gain: brightness; seed: layer id.
 * Returns light (not yet tone mapped); glowW keeps the strongest ignition seen at this pixel.
 */
vec3 rainLayer(vec2 frag, float cell, float speed, float blur, float gain, float density, float seed, float calm, inout float glowW) {
  vec2 f = frag + uParallax * gain;
  float col = floor(f.x / cell);
  vec4 hc = hash42(vec2(col, seed * 13.7));
  float fall = speed * (0.55 + 0.9 * hc.x);
  float yy = f.y / cell + uTime * fall + hc.y * 300.0;
  float row = floor(yy);
  vec2 local = vec2(fract(f.x / cell), fract(yy));
  vec4 hr = hash42(vec2(col, row) + seed * 31.1);

  // Streams: runs of cells, brightest at the leading (lowest) cell and fading up the trail.
  float len = 10.0 + 22.0 * hc.z;
  float u = (row + 0.5) / len + hc.w * 7.0;
  float run = floor(u), pos = fract(u);
  float live = step(0.45, hash12(vec2(col, run) + seed));
  float span = 0.45 + 0.4 * hash12(vec2(run, col) - seed);
  float trail = live * pow(clamp(1.0 - pos / span, 0.0, 1.0), 1.7);
  float head = live * step(pos * len, 1.0);

  // The cell's centre in pixels; its mark distance decides ignition for the whole glyph.
  vec2 centre = vec2((col + 0.5) * cell, (row + 0.5 - uTime * fall - hc.y * 300.0) * cell) - uParallax * gain;
  vec2 m = markUV(centre);
  float d = markSD(m);
  float ign = 1.0 - smoothstep(-0.01, 0.004, d);
  float halo = exp(-max(d, 0.0) * 40.0) * (1.0 - ign) * 0.8;

  // Which glyph: mostly fixed per cell, some cells flicker; the accent is rare.
  float flick = step(hr.x, 0.12) * floor(uTime * (0.6 + hr.y) + hr.z * 9.0);
  float h = hash12(vec2(col, row) * 1.37 + flick + seed);
  float g = floor(h * uGlyphs);
  if (uAccent > 0.5 && hr.w < 0.03) g = uGlyphs;
  // Streams are nearly unbroken runs of glyphs; inside the mark almost every cell holds one, so its shape reads solid.
  float present = step(hash12(vec2(row, col) * 0.71 + seed * 5.3), density + trail * 0.6 + ign * 0.8);

  // The glyph from the atlas, with analytic gradients so cell seams never pick a far mip.
  float size = mix(0.8, 1.0, hc.z);
  vec2 q = (local - 0.5) / size + 0.5;
  vec2 auv = vec2((g + clamp(q.x, 0.0, 1.0)) / uSlots, 1.0 - clamp(q.y, 0.0, 1.0));
  float lod = exp2(blur);
  vec2 dx = vec2(lod / (cell * size * uSlots), 0.0), dy = vec2(0.0, lod / (cell * size));
  float a = textureGrad(uAtlas, auv, dx, dy).a;
  // Bloom: a soft round glow under the glyph, gone by the cell's edge so no seams show.
  vec2 r = (local - 0.5) * vec2(1.25, 1.0);
  float bloom = exp(-dot(r, r) * 16.0) * 0.32;

  // Brightness: a faint ambient for every glyph, streams on top; ignited glyphs burn steadily.
  float cool = 0.05 + 0.8 * trail + 0.45 * head;
  float warm = 0.75 + 0.5 * trail + 0.4 * head;
  // Ignited glyphs keep most of their light even on the dim far layer, so the mark fills in.
  float b = mix(cool * calm * gain, warm * (0.45 + 0.55 * gain), ign) + halo * (0.15 + 0.6 * trail) * gain;
  b *= present;

  vec3 coolC = palette(0.68 + 0.22 * hc.w) * mix(0.85, 1.5, head);
  vec3 warmC = mix(gCoral, gPeach, clamp(trail * 0.8 + head + (m.y - 0.35) * 0.6, 0.0, 1.0));
  warmC = mix(warmC, vec3(1.0, 0.9, 0.82), head * 0.3);
  vec3 c = mix(coolC, warmC, max(ign, halo * 0.8));

  glowW = max(glowW, ign);
  return c * b * (a + bloom * uGlow * mix(0.25, 1.0, max(ign, halo)) * (0.4 + trail + 0.4 * head));
}

void main() {
  float aspect = uResolution.x / uResolution.y;
  vec2 frag = gl_FragCoord.xy;
  vec2 p = vec2(vUv.x * aspect, vUv.y);

  // Layout: wide boxes put the mark right of the card, partly off the edge; tall ones put it low.
  float tall = 1.0 - smoothstep(0.75, 1.15, aspect);
  gMarkC = mix(vec2(aspect - 0.17, 0.52), vec2(aspect * 0.56, 0.21), tall);
  gMarkS = mix(1.02, aspect * 1.25, tall);
  gCoral = palette(0.30);
  gPeach = palette(0.04);

  // Calm in the middle, where the sign-in card sits.
  float calm = mix(0.3, 1.0, smoothstep(0.12, 0.5, length((vUv - 0.5) * vec2(aspect, 1.0) * vec2(0.85, 1.1))));

  vec2 m = markUV(frag);
  float d = markSD(m);
  float inside = 1.0 - smoothstep(-0.004, 0.004, d);
  float t = uTime;

  // Ground light: a cool nebula drifting top-left, warm blurred light around the mark.
  float neb = vnoise(p * 1.6 + vec2(t * 0.02, -t * 0.015)) * vnoise(p * 3.1 - t * 0.01);
  vec3 col = palette(0.66) * neb * 0.22 * smoothstep(1.2, 0.0, length(p - vec2(0.1, 0.95)));
  col += palette(0.33) * exp(-abs(d) * 9.0) * 0.05 + palette(0.22) * exp(-max(d, 0.0) * 6.0) * 0.02;
  col += palette(0.2 + m.y * 0.2) * inside * 0.018;

  // The rain: far (small, slow, out of focus), mid, near (big, fast, sparse).
  float glowW = 0.0;
  col += rainLayer(frag, uCell * 0.62, 1.1, 1.4, 0.55, uDensity * 0.9, 1.0, calm, glowW);
  col += rainLayer(frag, uCell, 1.7, 0.0, 0.9, uDensity * 0.75, 2.0, calm, glowW);
  col += rainLayer(frag, uCell * 1.55, 2.6, 0.25, 1.0, uDensity * 0.28, 3.0, calm, glowW);

  // Now and then a glassy highlight sweeps across the mark, lifting the ignited glyphs.
  float cyc = t / 9.0;
  float sweepX = fract(cyc) * 2.6 - 0.8;
  float band = exp(-pow((m.x * 0.75 + m.y * 0.55 - sweepX) * 7.0, 2.0)) * step(0.3, hash12(vec2(floor(cyc), 3.0)));
  col += vec3(1.0, 0.9, 0.84) * band * (inside * 0.05 + glowW * 0.06);
  col *= 1.0 + band * glowW * 0.9;

  col = vec3(0.067, 0.063, 0.075) + tonemap(col * 1.2);
  col += (hash12(gl_FragCoord.xy + fract(uTime)) - 0.5) / 255.0;
  outColor = vec4(col, 1.0);
}`;
