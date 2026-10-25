import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import jsQR from "jsqr";
import {
  receipt, flipbook, qrReceipt, send, emulate, parse, textRows, invertText, dither,
  raster, nativeQr, cut, PAPER, encode, encodable, byteOf, charOf, HIGH,
} from "../src/index.js";

const GOLDEN = new URL("./golden/", import.meta.url);
const UPDATE = process.env.UPDATE_GOLDEN === "1";
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex").slice(0, 16);
const count = (bytes, seq) => { let n = 0; for (let i = 0; i <= bytes.length - seq.length; i++) if (seq.every((v, k) => bytes[i + k] === v)) n++; return n; };

// Jobs whose bytes are pinned. Pixels are pinned too when the emulator draws
// them dot by dot (no font glyphs), so the PNGs in test/golden can be looked at.
const JOBS = {
  "coin-text-58": () => receipt("spinning-coin", { paper: 58, at: 1 }),
  "coin-raster-80": () => receipt("spinning-coin", { paper: 80, mode: "raster", at: 1 }),
  "success-bayer-58": () => receipt("empty-payment-success", { paper: 58, mode: "raster", dither: "bayer", at: 3 }),
  "coin-flipbook-58": () => flipbook("spinning-coin", { paper: 58, frames: 3, every: 0.4, cut: false }),
  "qr-text-58": () => qrReceipt("https://pay.example/r/42", { paper: 58 }),
  "qr-raster-58": () => qrReceipt("https://pay.example/r/42", { paper: 58, mode: "raster" }),
  "qr-native-80": () => qrReceipt("https://pay.example/r/42", { paper: 80, native: true }),
};

test("goldens: bytes, and emulator pixels for dot-drawn jobs", async () => {
  const file = new URL("golden.json", GOLDEN);
  const want = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
  const got = {};
  for (const [name, make] of Object.entries(JOBS)) {
    const bytes = await make();
    const r = emulate(bytes, { paper: name.includes("-80") ? 80 : 58 });
    got[name] = { bytes: sha(bytes), length: bytes.length, ...(r.glyphs ? {} : { pixels: sha(r.rgba()) }), size: `${r.width}x${r.height}` };
    if (UPDATE) fs.writeFileSync(new URL(`${name}.png`, GOLDEN), r.png());
  }
  if (UPDATE) fs.writeFileSync(file, JSON.stringify(got, null, 2) + "\n");
  assert.deepEqual(got, want);
});

const scan = (bytes, paper) => { const r = emulate(bytes, { paper }); const d = r.rgba(); return jsQR(new Uint8ClampedArray(d.buffer, d.byteOffset, d.byteLength), r.width, r.height)?.data ?? null; };

for (const url of ["https://pay.example/r/42", "https://pay.example/onboarding/merchant/7f3a9c?ref=pos-terminal-0042"]) {
  for (const paper of [58, 80]) {
    test(`QR round trip on ${paper} mm: text, raster and native print what jsQR reads (${url.length} chars)`, async () => {
      assert.equal(scan(await qrReceipt(url, { paper }), paper), url, "text");
      assert.equal(scan(await qrReceipt(url, { paper, mode: "raster" }), paper), url, "raster");
      assert.equal(scan(await qrReceipt(url, { paper, native: true }), paper), url, "native");
    });
  }
}

test("QR text mode picks font B, then raster, when font A is too narrow", async () => {
  const short = parse(await qrReceipt("https://pay.example/r/42", { paper: 58 }));
  assert.equal(short.ops.find((o) => o.op === "char").w, 9, "37 columns: font B on 58 mm");
  const long = parse(await qrReceipt("https://pay.example/" + "x".repeat(90), { paper: 58 }));
  assert.ok(long.ops.some((o) => o.op === "raster"), "too wide for font B: raster");
});

test("CP437: the block and shade glyphs, and a full high half", () => {
  assert.equal([...HIGH].length, 128);
  assert.deepEqual(encode("░▒▓█▄▌▐▀■"), [0xb0, 0xb1, 0xb2, 0xdb, 0xdc, 0xdd, 0xde, 0xdf, 0xfe]);
  assert.deepEqual(encode("┌─┐│└┘"), [0xda, 0xc4, 0xbf, 0xb3, 0xc0, 0xd9]);
  for (let b = 0x20; b < 0x100; b++) if (b !== 0x7f) assert.equal(byteOf(charOf(b)), b, `0x${b.toString(16)}`);
  assert.deepEqual(encode("a•☃"), [0x61, 0xf9, 0x3f], "near neighbour, then ?");
  assert.ok(encodable("▀▄█ ab") && !encodable("•"));
});

test("text mode: frames that fit print as they are; wider ones are shaded to the paper", () => {
  assert.deepEqual(textRows({ text: "▀▄█\n ┌┐", color: "000\n 00" }, { 0: "#ffffff" }, { cols: 32 }), ["▀▄█", " ┌┐"]);
  const wide = Array.from({ length: 20 }, (_, y) => "@".repeat(60 - y)).join("\n");
  const rows = textRows(wide, null, { cols: 32 });
  assert.ok(rows.every((r) => [...r].length === 32));
  assert.ok(rows.every((r) => /^[ ░▒▓█]+$/.test(r)));
  assert.deepEqual(invertText(["▀ █▐░"]), ["▄█ ▌▓"]);
});

test("raster: GS v 0 in bands of at most 255 rows", () => {
  const bits = new Uint8Array(48 * 600).fill(0xaa);
  const out = raster(bits, 48, 600);
  assert.equal(out.length, 3 * 8 + bits.length);
  assert.deepEqual(out.slice(0, 8), [0x1d, 0x76, 0x30, 0, 48, 0, 255, 0]);
  assert.deepEqual(out.slice(8 + 48 * 255, 16 + 48 * 255), [0x1d, 0x76, 0x30, 0, 48, 0, 255, 0]);
  assert.deepEqual(out.slice(16 + 48 * 510, 24 + 48 * 510), [0x1d, 0x76, 0x30, 0, 48, 0, 90, 0]);
  const p = parse(Uint8Array.from(out), { paper: 58 });
  assert.equal(p.height, 600);
});

test("raster: ink is capped (default 60%) and dithers keep the mean", () => {
  const w = 64, h = 64, full = new Float32Array(w * h).fill(0.6);
  for (const m of ["floyd", "bayer"]) {
    const { bits } = dither(full, w, h, m);
    let on = 0; for (const b of bits) for (let k = 0; k < 8; k++) on += (b >> k) & 1;
    assert.ok(Math.abs(on / (w * h) - 0.6) < 0.03, `${m}: ${(on / (w * h)).toFixed(3)}`);
  }
});

test("native QR bytes: model 2, size, ECC, store, print", () => {
  const b = nativeQr("hi", { size: 5, ecc: "Q" });
  assert.deepEqual(b.slice(0, 9), [0x1d, 0x28, 0x6b, 4, 0, 49, 65, 50, 0]);
  assert.deepEqual(b.slice(9, 17), [0x1d, 0x28, 0x6b, 3, 0, 49, 67, 5]);
  assert.deepEqual(b.slice(17, 25), [0x1d, 0x28, 0x6b, 3, 0, 49, 69, 50]);
  assert.deepEqual(b.slice(25, 35), [0x1d, 0x28, 0x6b, 5, 0, 49, 80, 48, 0x68, 0x69]);
  assert.deepEqual(b.slice(35), [0x1d, 0x28, 0x6b, 3, 0, 49, 81, 48]);
});

test("every job starts ESC @, FS ., ESC t 0; paper widths", async () => {
  const b = await receipt("spinning-coin", { paper: 80 });
  assert.deepEqual([...b.slice(0, 7)], [0x1b, 0x40, 0x1c, 0x2e, 0x1b, 0x74, 0]);
  assert.deepEqual(PAPER, { 58: { dots: 384, a: 32, b: 42 }, 80: { dots: 576, a: 48, b: 64 } });
  const p = parse(b, { paper: 80 });
  assert.ok(p.ops.filter((o) => o.op === "char").every((o) => o.x >= 0 && o.x + o.w <= 576));
});

test("flipbook: N frames, each numbered, each cut", async () => {
  const b = await flipbook("spinning-coin", { frames: 4, every: 0.25 });
  assert.equal(count([...b], cut()), 4);
  for (const n of ["1/4", "4/4"]) assert.ok(count([...b], [...encode(n), 0x0a]) === 1, n);
  const ruled = await flipbook("spinning-coin", { frames: 4, cut: false });
  assert.equal(count([...ruled], [0x1d, 0x56]), 0);
});

test("emulator is strict about commands it doesn't know", () => {
  assert.throws(() => emulate(Uint8Array.from([0x1b, 0x40, 0x1b, 0x99])), /unknown ESC 0x99/);
  assert.throws(() => emulate(Uint8Array.from([0x1b, 0x74, 16])), /code page 16/);
  assert.doesNotThrow(() => emulate(Uint8Array.from([0x1b, 0x99, 0x41, 0x0a]), { strict: false }));
});

test("send: raw TCP (port 9100 style) and files", async () => {
  const job = await qrReceipt("https://pay.example/r/42", { native: true });
  const got = [];
  const server = net.createServer((s) => s.on("data", (d) => got.push(d)));
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const closed = new Promise((r) => server.on("connection", (s) => s.on("close", r)));
  const res = await send(job, `tcp://127.0.0.1:${server.address().port}`);
  await closed;
  server.close();
  assert.equal(res.kind, "tcp");
  assert.deepEqual(Buffer.concat(got), Buffer.from(job));
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "escpos-")), "job.bin");
  assert.equal((await send(job, file)).kind, "file");
  assert.deepEqual(fs.readFileSync(file), Buffer.from(job));
  await assert.rejects(send(job, "tcp://127.0.0.1:1", { timeout: 2000 }));
});
