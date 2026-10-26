// PixelSnow's flake sprites, from React Bits (reactbits.dev, MIT + Commons Clause), unchanged.
// Per variant: sizes 1 to 5 (1, 3, 5, 7, 9 px), then alternates for sizes 3 to 5.
// "@" is a bright core pixel, "o" a mid pixel, "x" a body-only pixel, "." empty.
import { CELL, SLOTS } from "./glsl.js";

export type PixelSnowVariant = "square" | "round" | "snowflake";

export const VARIANTS: readonly PixelSnowVariant[] = ["square", "round", "snowflake"];

export const SPRITES: Record<PixelSnowVariant, string[][]> = {
  square: [
    ["@"],
    ["oo", "oo"],
    ["xox", "o@o", "xox"],
    ["xoox", "o@@o", "o@@o", "xoox"],
    ["xooox", "oo@oo", "o@@@o", "oo@oo", "xooox"],
    ["xox", "o@o", "xox"],
    ["xoox", "o@@o", "o@@o", "xoox"],
    ["xooox", "oo@oo", "o@@@o", "oo@oo", "xooox"],
  ],
  round: [
    ["@"],
    [".x.", "x@x", ".x."],
    [".xx.", "x@@x", "x@@x", ".xx."],
    [".xxx.", "xo@ox", "x@@@x", "xo@ox", ".xxx."],
    ["..xxx..", ".xooox.", "xoo@oox", "xo@@@ox", "xoo@oox", ".xooox.", "..xxx.."],
    [".xx.", "x@@x", "x@@x", ".xx."],
    [".xxx.", "xo@ox", "x@@@x", "xo@ox", ".xxx."],
    ["..xxx..", ".xooox.", "xoo@oox", "xo@@@ox", "xoo@oox", ".xooox.", "..xxx.."],
  ],
  snowflake: [
    ["@"],
    [".x.", "x@x", ".x."],
    ["..x..", "x.o.x", ".o@o.", "x.o.x", "..x.."],
    ["...x...", ".x.o.x.", "..ooo..", "xoo@oox", "..ooo..", ".x.o.x.", "...x..."],
    [
      "....x....",
      ".x..o..x.",
      "..o.o.o..",
      "...ooo...",
      "xooo@ooox",
      "...ooo...",
      "..o.o.o..",
      ".x..o..x.",
      "....x....",
    ],
    ["x...x", ".o.o.", "..@..", ".o.o.", "x...x"],
    ["x..x..x", ".o.o.o.", "..ooo..", "xoo@oox", "..ooo..", ".o.o.o.", "x..x..x"],
    [
      "x...x...x",
      ".o..o..o.",
      "..o.o.o..",
      "...ooo...",
      "xooo@ooox",
      "...ooo...",
      "..o.o.o..",
      ".o..o..o.",
      "x...x...x",
    ],
  ],
};

/** Every sprite in one RGBA atlas: a row per variant, a CELL-sized cell per slot. R marks a pixel, G its core brightness. */
export const buildAtlas = () => {
  const width = CELL * SLOTS;
  const height = CELL * VARIANTS.length;
  const data = new Uint8Array(width * height * 4);
  VARIANTS.forEach((variant, row) => {
    SPRITES[variant].forEach((rows, level) => {
      rows.forEach((line, y) => {
        for (let x = 0; x < line.length; x++) {
          const mark = line[x];
          if (mark === ".") continue;
          const offset = ((row * CELL + y) * width + level * CELL + x) * 4;
          data[offset] = 255;
          data[offset + 1] = mark === "@" ? 255 : mark === "o" ? 128 : 0;
          data[offset + 3] = 255;
        }
      });
    });
  });
  return { data, width, height };
};
