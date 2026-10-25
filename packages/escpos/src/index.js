/*
 * ascii-magic-art-escpos: ascii-magic-art pieces and QR codes on ESC/POS
 * thermal receipt printers, 58 mm and 80 mm.
 *
 *   import { receipt, flipbook, qrReceipt, send, emulate } from "ascii-magic-art-escpos";
 *   const job = await receipt("spinning-coin", { paper: 80, mode: "raster" });
 *   await send(job, "tcp://192.168.1.50:9100");           // or "/dev/usb/lp0", or a file
 *   fs.writeFileSync("preview.png", emulate(job, { paper: 80 }).png());
 *
 * Text mode prints CP437 block and shade glyphs (ESC t 0); raster mode prints a
 * dithered GS v 0 image of the frame as the web player draws it.
 */
export { receipt, flipbook, qrReceipt, MODES } from "./receipt.js";
export { send } from "./transport.js";
export { emulate, parse } from "./emulate.js";
export { textRows, invertText, SHADES } from "./text.js";
export { rasterFrame, dither, inkFromRgba, DITHERS } from "./raster.js";
export { Job, start, init, cancelKanji, codePage, align, font, bold, lineSpacing, feed, cut, line, raster, nativeQr, PAPER, FONTS } from "./encode.js";
export { encode, encodable, byteOf, charOf, HIGH } from "./cp437.js";
