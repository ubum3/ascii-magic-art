/*
 * transport.js: send a job to a file, a network printer or a USB printer.
 *
 *   tcp://host[:port]   raw TCP, port 9100 by default (JetDirect / "RAW")
 *   /dev/usb/lp0        a USB printer on Linux (usblp); needs write access (group lp)
 *   anything else       a file, written as is
 */
import fs from "fs";
import net from "net";

/** Write bytes to a target; resolves with { kind, bytes } once sent and closed. */
export async function send(bytes, target, { timeout = 10000 } = {}) {
  const buf = Buffer.from(bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes);
  if (/^tcp:\/\//i.test(target)) {
    const u = new URL(target);
    const port = Number(u.port) || 9100;
    await new Promise((resolve, reject) => {
      const sock = net.connect({ host: u.hostname, port });
      sock.setTimeout(timeout, () => sock.destroy(new Error(`escpos: no answer from ${u.hostname}:${port} in ${timeout} ms`)));
      sock.once("error", reject);
      sock.once("connect", () => sock.end(buf));
      sock.once("close", (hadError) => { if (!hadError) resolve(); });
    });
    return { kind: "tcp", bytes: buf.length };
  }
  try {
    fs.writeFileSync(target, buf);
  } catch (e) {
    if (target.startsWith("/dev/") && e.code === "EACCES") throw new Error(`escpos: can't write ${target}: add yourself to its group (usually lp) and log in again`);
    throw e;
  }
  return { kind: target.startsWith("/dev/") ? "device" : "file", bytes: buf.length };
}
