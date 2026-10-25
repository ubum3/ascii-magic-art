#!/usr/bin/env node
/*
 * ama-escpos: print ascii-magic-art pieces and QR codes on ESC/POS receipt printers.
 */
import fs from "fs";
import { parseArgs } from "util";
import { receipt, flipbook, qrReceipt, send, emulate } from "../src/index.js";

const HELP = `ama-escpos: ascii-magic-art on ESC/POS thermal receipt printers.

  ama-escpos <slug|spec.json|clip.amc|piece.js> [options]
  ama-escpos --qr "<text>" [options]

Output
  -o, --out TARGET     tcp://host[:9100], /dev/usb/lp0, or a file (default receipt.bin)
  --png FILE           also draw the job with the emulator, to check it without a printer

Options
  --paper 58|80        paper width in mm (default 58: 384 dots; 80: 576 dots)
  --font a|b           font A 12x24 dots (32/48 columns) or B 9x17 (42/64 columns)
  --mode text|raster   CP437 block glyphs, or a dithered GS v 0 image (default text)
  --at S               the time of the frame to print (default 1.5)
  --frames N --every S --from S   a flipbook: N frames, S seconds apart, each cut off
  --dither floyd|bayer|threshold  raster dithering (default floyd)
  --ink 0..1           raster darkness cap (default 0.6; solid black heats the head)
  --invert             swap ink and paper
  --shade              text mode: always shade, even when the frame would print as it is
  --look NAME          draw the piece in a look first
  --title TEXT         a bold line above
  --qr TEXT            print a QR code; --native lets the printer draw it (GS ( k)
  --ecc L|M|Q|H        QR error correction (default M)
  --no-cut             no cut at the end (flipbooks get dashed rules instead)
`;

const { values: o, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    out: { type: "string", short: "o", default: "receipt.bin" }, png: { type: "string" },
    paper: { type: "string", default: "58" }, font: { type: "string", default: "a" }, mode: { type: "string", default: "text" },
    at: { type: "string" }, frames: { type: "string" }, every: { type: "string" }, from: { type: "string" },
    dither: { type: "string", default: "floyd" }, ink: { type: "string" }, invert: { type: "boolean" }, shade: { type: "boolean" },
    look: { type: "string" }, title: { type: "string" }, qr: { type: "string" }, native: { type: "boolean" }, ecc: { type: "string" },
    "no-cut": { type: "boolean" }, help: { type: "boolean", short: "h" },
  },
});
if (o.help || (!positionals.length && !o.qr)) { process.stdout.write(HELP); process.exit(o.help ? 0 : 1); }

const num = (v) => (v == null ? undefined : Number(v));
const opts = {
  paper: Number(o.paper), font: o.font, mode: o.mode, at: num(o.at), dither: o.dither, ink: num(o.ink),
  invert: o.invert, shade: o.shade, title: o.title, ecc: o.ecc, native: o.native, cut: !o["no-cut"],
  look: o.look ? { look: o.look } : undefined, frames: num(o.frames), every: num(o.every), from: num(o.from),
};
for (const k of Object.keys(opts)) if (opts[k] === undefined) delete opts[k];

try {
  const job = o.qr ? await qrReceipt(o.qr, opts) : o.frames ? await flipbook(positionals[0], opts) : await receipt(positionals[0], opts);
  if (o.png) fs.writeFileSync(o.png, emulate(job, { paper: opts.paper }).png());
  const r = await send(job, o.out);
  console.log(`${r.bytes} bytes to ${o.out}${o.png ? `, preview in ${o.png}` : ""}`);
} catch (e) {
  console.error(`ama-escpos: ${e.message}`);
  process.exit(1);
}
