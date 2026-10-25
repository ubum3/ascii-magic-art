/*
 * guard.js: the server's limits. Files it reads must be inside the working
 * directory or the system temp folder and at most 20 MB; files it writes must be
 * inside the working directory or <tmp>/ama-mcp, and an existing file is only
 * replaced when the call says overwrite. Every call gets 60 seconds.
 */
import fs from "fs";
import os from "os";
import path from "path";

export const MAX_INPUT = 20 * 1024 * 1024;
export const TIMEOUT = 60_000;
export const OUT_DIR = path.join(os.tmpdir(), "ama-mcp");

const real = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
const within = (file, root) => { const rel = path.relative(root, file); return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel)); };
const cwd = () => real(process.cwd());

/** A file to read: resolved against the working directory, symlinks followed, then checked. */
export function inputPath(p) {
  const abs = path.resolve(p);
  if (!fs.existsSync(abs)) throw new Error(`no file at ${p}`);
  const file = real(abs);
  if (![cwd(), real(os.tmpdir())].some((r) => within(file, r))) throw new Error(`${p} is outside the working directory and the temp folder`);
  const st = fs.statSync(file);
  if (!st.isFile()) throw new Error(`${p} is not a file`);
  if (st.size > MAX_INPUT) throw new Error(`${p} is ${(st.size / 1048576).toFixed(1)} MB: the limit is 20 MB`);
  return file;
}

/** A file to write, with the extension `ext`: <tmp>/ama-mcp/<name>.<ext> by default. */
export function outputPath(p, ext, { name = "ama", overwrite = false } = {}) {
  let abs;
  if (p) {
    abs = path.resolve(p);
    if (path.extname(abs).toLowerCase() !== "." + ext) abs += "." + ext;
  } else {
    abs = path.join(OUT_DIR, `${name.replace(/[^\w.-]+/g, "-").slice(0, 60) || "ama"}.${ext}`);
  }
  const dir = path.dirname(abs);
  // check before creating anything: the deepest existing folder, symlinks followed, must be inside a root
  let probe = dir;
  while (!fs.existsSync(probe)) probe = path.dirname(probe);
  const realDir = path.join(real(probe), path.relative(probe, dir));
  if (![cwd(), real(OUT_DIR), path.join(real(os.tmpdir()), "ama-mcp")].some((r) => within(realDir, r))) {
    throw new Error(`can't write ${p}: output goes inside the working directory or ${OUT_DIR}`);
  }
  const file = path.join(realDir, path.basename(abs));
  if (fs.existsSync(file)) {
    if (fs.lstatSync(file).isSymbolicLink()) throw new Error(`${file} is a symlink: not writing through it`);
    if (!overwrite) throw new Error(`${file} exists: pass overwrite: true to replace it`);
  }
  fs.mkdirSync(realDir, { recursive: true });
  return file;
}

/** The promise, or a rejection after `ms`. */
export function withTimeout(promise, ms = TIMEOUT) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_, no) => { timer = setTimeout(() => no(new Error(`timed out after ${ms / 1000}s`)), ms); timer.unref?.(); }),
  ]).finally(() => clearTimeout(timer));
}
