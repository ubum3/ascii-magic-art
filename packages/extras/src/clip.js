/*
 * clip.js: the .amc clip format, frames recorded from a video, a GIF or any piece.
 *
 *   "AMC1", u32 LE header length, JSON header, then one raw-deflate stream of
 *   every frame as text "\0" color "\0" (color is empty for a plain frame).
 *   header: { version: 1, cols, rows, fps, frames, square, loop, palette, name }
 *
 * Playing a clip is picking a frame by time, so the Rust and Go packages read
 * clips natively. Here the caller brings the (de)compressor, since it differs
 * between Node (zlib) and browsers (DecompressionStream, which is async).
 */
const MAGIC = "AMC1";

/** Encode frames ({text, color} or strings) to clip bytes. deflateRaw: Uint8Array -> Uint8Array. */
export function encodeClip(header, frames, deflateRaw) {
  const body = frames.map((f) => (typeof f === "string" ? f + "\0\0" : f.text + "\0" + (f.color || "") + "\0")).join("");
  const z = deflateRaw(new TextEncoder().encode(body));
  const head = new TextEncoder().encode(JSON.stringify({ version: 1, loop: true, square: false, ...header, frames: frames.length }));
  const out = new Uint8Array(8 + head.length + z.length);
  for (let i = 0; i < 4; i++) out[i] = MAGIC.charCodeAt(i);
  new DataView(out.buffer).setUint32(4, head.length, true);
  out.set(head, 8);
  out.set(z, 8 + head.length);
  return out;
}

/** Split clip bytes into its header and the still-compressed frames. */
export function readClipHeader(bytes) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (String.fromCharCode(b[0], b[1], b[2], b[3]) !== MAGIC) throw new Error("not an .amc clip");
  const n = new DataView(b.buffer, b.byteOffset, b.byteLength).getUint32(4, true);
  const header = JSON.parse(new TextDecoder().decode(b.subarray(8, 8 + n)));
  return { header, body: b.subarray(8 + n) };
}

/** Decode clip bytes. inflateRaw: Uint8Array -> Uint8Array. Returns { header, frames }. */
export function decodeClip(bytes, inflateRaw) {
  const { header, body } = readClipHeader(bytes);
  return { header, frames: splitFrames(new TextDecoder().decode(inflateRaw(body)), header.frames) };
}

export function splitFrames(s, count) {
  const parts = s.split("\0"), frames = [];
  for (let i = 0; i + 1 < parts.length && frames.length < count; i += 2) frames.push(parts[i + 1] ? { text: parts[i], color: parts[i + 1] } : parts[i]);
  return frames;
}

/** A piece module that plays decoded clip frames. */
export function clipPiece({ header, frames }) {
  const meta = {
    slug: header.name || "clip", name: header.name || "Clip", category: "extras", note: "", tags: ["extras", "clip"],
    cols: header.cols, rows: header.rows, fps: header.fps, palette: header.palette,
    ...(header.square ? { cell: "square" } : {}),
  };
  const create = () => (t) => {
    let i = Math.floor(t * header.fps);
    i = header.loop === false ? Math.min(frames.length - 1, i) : ((i % frames.length) + frames.length) % frames.length;
    return frames[i];
  };
  return { meta, default: create };
}
