/* lumino-donut: the Lumino brandmark, extruded into a glassy solid and tumbling like donut.c, its edges catching rainbow light. */
import { Grid, RAMPS, ramp, rotX, rotY, rotZ, palette, gradient, hsl, KEYS, TAU, definePiece } from "ascii-magic-art-react/kit";
import { MASK } from "./mask.js";

const GLASS = gradient(["#2b3550", "#6f7fa8", "#c9d6f2", "#ffffff"], 8); // keys 0-7: the faces
const HUES = 24; // keys 8-31: the rainbow edges
const RAINBOW = Array.from({ length: HUES }, (_, i) => hsl((i * 360) / HUES, 90, 68));
const COLS = 80, ROWS = 40;

/** One loop, in seconds: a full spin, 2π / 1.1. */
export const LUMINO_DONUT_PERIOD = (2 * Math.PI) / 1.1;

export const luminoDonut = definePiece(
  {
    slug: "lumino-donut", name: "Lumino Donut", category: "solids", cols: COLS, rows: ROWS, fps: 30,
    note: "The Lumino brandmark extruded into a glassy solid, tumbling like donut.c, its edges catching rainbow light.",
    palette: palette([...GLASS, ...RAINBOW]),
  },
  () => {
    const g = new Grid(COLS, ROWS);
    const H = MASK.length, W = MASK[0].length, DEPTH = 16, STEP = 0.5;
    const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < W && y < H && MASK[y][x] === "#" ? 1 : 0);
    // Surface samples [x, y, z, normal, hue 0-1 or -1 for clear glass]: front and back faces, plus side walls where the mask ends.
    const pts: number[][] = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (!at(x, y)) continue;
      let nx = 0, ny = 0; // outward wall normal from a 7x7 neighbourhood
      for (let j = -3; j <= 3; j++) for (let i = -3; i <= 3; i++) if (!at(x + i, y + j)) { nx += i; ny -= j; }
      const edge = !at(x - 1, y) || !at(x + 1, y) || !at(x, y - 1) || !at(x, y + 1);
      const l = Math.hypot(nx, ny), hue = l ? (Math.atan2(ny, nx) / TAU) * 0.25 : -1; // a little hue drift round the outline
      const faceHue = edge ? hue : -1; // the faces' outermost pixel glints too
      for (let u = 0; u < 1; u += STEP) for (let v = 0; v < 1; v += STEP) {
        const px = x + u - W / 2, py = H / 2 - (y + v);
        pts.push([px, py, DEPTH / 2, 0, 0, 1, faceHue], [px, py, -DEPTH / 2, 0, 0, -1, faceHue]);
        // a spectrum front to back, like a prism
        if (edge && l) for (let z = -DEPTH / 2 + STEP / 2; z < DEPTH / 2; z += STEP) pts.push([px, py, z, nx / l, ny / l, 0, hue + (z / DEPTH + 0.5) * 0.7]);
      }
    }
    const L = [-0.42, 0.42, 0.8]; // light from up-left, in front
    const scale = (ROWS * 0.58) / H, cam = 420;
    return (t) => {
      g.clear();
      // A full spin while it rocks forward and back and rolls side to side.
      const A = t * 1.1, B = 0.2 + Math.sin(A) * 0.55, C = Math.sin(A * 2 + 1) * 0.3;
      // The turn as a 3x3 matrix, made once a frame: its columns are where the x, y and z axes end up.
      const [m0, m3, m6] = rotX(rotZ(rotY([1, 0, 0], A), C), B);
      const [m1, m4, m7] = rotX(rotZ(rotY([0, 1, 0], A), C), B);
      const [m2, m5, m8] = rotX(rotZ(rotY([0, 0, 1], A), C), B);
      for (const [x, y, z, a, b, c, hue] of pts) {
        const nz = m6 * a + m7 * b + m8 * c;
        if (nz < -0.1) continue;
        const nx = m0 * a + m1 * b + m2 * c, ny = m3 * a + m4 * b + m5 * c;
        const px = m0 * x + m1 * y + m2 * z, py = m3 * x + m4 * y + m5 * z, pz = m6 * x + m7 * y + m8 * z;
        const k = cam / (cam - pz);
        const lum = Math.max(0, nx * L[0] + ny * L[1] + nz * L[2]);
        // The rainbow slides with the view angle, so the colours shift as it turns, like light through glass.
        const co = hue < 0 ? KEYS[Math.min(7, Math.floor(lum * 8))]
          : KEYS[8 + (Math.floor(((((hue + nx * 0.4 + A / TAU) % 1) + 1) % 1) * HUES) % HUES)];
        g.setZ(COLS / 2 + px * scale * 2 * k, ROWS / 2 - py * scale * k, pz, ramp(0.12 + lum * 0.88, RAMPS.soft), co);
      }
      return g.frame();
    };
  },
);
