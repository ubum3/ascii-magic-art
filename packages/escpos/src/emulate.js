/*
 * emulate.js: an ESC/POS job back to a picture of the receipt, so jobs can be
 * checked without a printer. It understands the commands encode.js writes
 * (plus ESC ! and CR) and, by default, throws on anything else, so an encoder
 * bug can't hide.
 *
 *   const r = emulate(bytes, { paper: 58 });
 *   fs.writeFileSync("receipt.png", r.png());
 *
 * Dots are pixels: 384 wide for 58 mm, 576 for 80 mm. Block and shade glyphs,
 * raster images, QR codes and cut marks are drawn dot by dot, so they come out
 * the same everywhere; other characters go through the canvas's monospace font.
 */
import { createCanvas, ImageData } from "@napi-rs/canvas";
import { qrMatrix } from "ascii-magic-art-qr";
import { charOf } from "./cp437.js";
import { PAPER, FONTS } from "./encode.js";

const BLOCKS = {
  "█": (x, y, w, h) => true,
  "▀": (x, y, w, h) => y < h / 2,
  "▄": (x, y, w, h) => y >= h / 2,
  "▌": (x, y, w, h) => x < w / 2,
  "▐": (x, y, w, h) => x >= w / 2,
  "░": (x, y) => (x & 1) === 0 && (y & 1) === 0,
  "▒": (x, y) => ((x + y) & 1) === 0,
  "▓": (x, y) => !((x & 1) === 0 && (y & 1) === 0),
  "■": (x, y, w, h) => x >= w * 0.2 && x < w * 0.8 && y >= h * 0.3 && y < h * 0.7,
};
const ECC = { 48: "L", 49: "M", 50: "Q", 51: "H" };

/** Parse a job into ops and the paper length. */
export function parse(bytes, { paper = 58, strict = true } = {}) {
  const dots = (PAPER[paper] || PAPER[58]).dots;
  const ops = [];
  let fontName = "a", isBold = false, where = 0, spacing = 30, y = 0, line = [];
  let qr = { size: 3, ecc: "L", data: null };
  const reset = () => { fontName = "a"; isBold = false; where = 0; spacing = 30; };
  const fail = (i, what) => { if (strict) throw new Error(`escpos emulate: ${what} at byte ${i}`); };
  const xFor = (w) => (where === 1 ? Math.floor((dots - w) / 2) : where === 2 ? dots - w : 0);
  const flush = () => {
    const [cw, ch] = FONTS[fontName];
    let x = xFor(line.length * cw);
    for (const c of line) { ops.push({ op: "char", c, x, y, w: cw, h: ch, bold: isBold }); x += cw; }
    line = [];
    y += spacing;
  };
  const b = bytes;
  for (let i = 0; i < b.length; i++) {
    const c = b[i];
    if (c === 0x0a) { flush(); continue; }
    if (c === 0x0d) continue;
    if (c >= 0x20 && c !== 0x7f) { line.push(charOf(c)); continue; }
    if (c === 0x1b) {
      const k = b[++i];
      if (k === 0x40) reset();
      else if (k === 0x74) { const n = b[++i]; if (n !== 0) fail(i, `code page ${n} (only 0, CP437, is emulated)`); }
      else if (k === 0x61) where = b[++i] % 48;
      else if (k === 0x4d) fontName = b[++i] % 48 === 1 ? "b" : "a";
      else if (k === 0x45) isBold = (b[++i] & 1) === 1;
      else if (k === 0x21) { const n = b[++i]; fontName = n & 1 ? "b" : "a"; isBold = !!(n & 8); }
      else if (k === 0x32) spacing = 30;
      else if (k === 0x33) spacing = b[++i];
      else if (k === 0x64) { if (line.length) flush(); y += b[++i] * spacing; }
      else fail(i, `unknown ESC 0x${(k ?? 0).toString(16)}`);
      continue;
    }
    if (c === 0x1c) {
      const k = b[++i];
      if (k !== 0x2e) fail(i, `unknown FS 0x${(k ?? 0).toString(16)}`);
      continue;
    }
    if (c === 0x1d) {
      const k = b[++i];
      if (k === 0x76 && b[i + 1] === 0x30) {
        const wb = b[i + 3] | (b[i + 4] << 8), h = b[i + 5] | (b[i + 6] << 8);
        const start = i + 7;
        if (start + wb * h > b.length) { fail(i, "raster runs past the end"); break; }
        if (line.length) flush();
        ops.push({ op: "raster", x: xFor(wb * 8), y, wb, h, bits: b.subarray(start, start + wb * h) });
        y += h;
        i = start + wb * h - 1;
      } else if (k === 0x56) {
        const m = b[++i];
        const n = m === 65 || m === 66 ? b[++i] : 0;
        if (line.length) flush();
        ops.push({ op: "cut", y: y + 4, partial: m === 1 || m === 49 || m === 66 });
        y += 8 + n;
      } else if (k === 0x28 && b[i + 1] === 0x6b) {
        const len = b[i + 2] | (b[i + 3] << 8), cn = b[i + 4], fn = b[i + 5], body = b.subarray(i + 6, i + 4 + len);
        if (cn !== 49) fail(i, `GS ( k cn ${cn}`);
        if (fn === 67) qr.size = body[0];
        else if (fn === 69) qr.ecc = ECC[body[0]] || "L";
        else if (fn === 80) qr.data = new TextDecoder().decode(body.subarray(1));
        else if (fn === 81) {
          if (line.length) flush();
          if (qr.data != null) {
            const m = qrMatrix(qr.data, { ecc: qr.ecc, boost: false });
            const w = m.size * qr.size;
            ops.push({ op: "qr", x: xFor(w), y, m, scale: qr.size });
            y += w;
          }
        } else if (fn !== 65) fail(i, `GS ( k fn ${fn}`);
        i += 3 + len;
      } else fail(i, `unknown GS 0x${(k ?? 0).toString(16)}`);
      continue;
    }
    fail(i, `control byte 0x${c.toString(16)}`);
  }
  if (line.length) flush();
  return { ops, width: dots, height: Math.max(1, y) };
}

/**
 * Draw a job: { width, height, glyphs, canvas, rgba, png() }. glyphs counts the
 * characters drawn with the font (the rest are drawn dot by dot).
 */
export function emulate(bytes, opts = {}) {
  const { ops, width, height } = parse(bytes, opts);
  const px = new Uint8ClampedArray(width * height * 4).fill(255);
  const ink = (x, y) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const i = (y * width + x) * 4;
    px[i] = px[i + 1] = px[i + 2] = 0;
  };
  const text = [];
  for (const o of ops) {
    if (o.op === "char") {
      const f = BLOCKS[o.c];
      if (f) { for (let yy = 0; yy < o.h; yy++) for (let xx = 0; xx < o.w; xx++) if (f(xx, yy, o.w, o.h)) ink(o.x + xx, o.y + yy); }
      else if (o.c !== " " && o.c !== " ") text.push(o);
    } else if (o.op === "raster") {
      for (let yy = 0; yy < o.h; yy++) for (let xx = 0; xx < o.wb * 8; xx++) if (o.bits[yy * o.wb + (xx >> 3)] & (0x80 >> (xx & 7))) ink(o.x + xx, o.y + yy);
    } else if (o.op === "qr") {
      for (let my = 0; my < o.m.size; my++) for (let mx = 0; mx < o.m.size; mx++) {
        if (!o.m.dark(mx, my)) continue;
        for (let yy = 0; yy < o.scale; yy++) for (let xx = 0; xx < o.scale; xx++) ink(o.x + mx * o.scale + xx, o.y + my * o.scale + yy);
      }
    } else if (o.op === "cut") {
      for (let x = 0; x < width; x++) if ((x >> 2) % 2 === 0) ink(x, o.y);
    }
  }
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.putImageData(new ImageData(px, width, height), 0, 0);
  if (text.length) {
    ctx.fillStyle = "#000";
    ctx.textBaseline = "top";
    for (const o of text) {
      ctx.font = `${o.bold ? "bold " : ""}${Math.round(o.h * 0.9)}px "DejaVu Sans Mono", Menlo, Consolas, monospace`;
      const w = ctx.measureText(o.c).width || o.w;
      ctx.save();
      ctx.translate(o.x, o.y + o.h * 0.05);
      ctx.scale(Math.min(1, o.w / w), 1);
      ctx.fillText(o.c, 0, 0);
      ctx.restore();
    }
  }
  return {
    width, height, glyphs: text.length, canvas,
    rgba: () => canvas.getContext("2d").getImageData(0, 0, width, height).data,
    png: () => canvas.toBuffer("image/png"),
  };
}
