// Packs the web4 export (out-web4/) into dist-web4/fig-live-web4.tgz for Fig's GPU computer, plus a
// base64 copy (.tgz.b64) and SHA256SUMS. Run by `npm run build:web4` after `next build`.
//
// Fig extracts the tarball into /workspace/public, which ALSO holds Fig's own files: fig-v*.sh (the kit
// releases the install line downloads), fig.sh, install.html, feedback.html and kit-files/. The tarball must never
// contain those names, so this script refuses to pack if it finds any of them (or any .sh at all).
//
// Reproducible: entries are sorted, every mtime is fixed, owner is root:root, modes are 0644/0755, the
// format is plain ustar (no pax headers, no macOS ._ files or xattrs), and gzip carries no name or time.
// The same out-web4/ always packs to the same bytes; the script packs twice and compares to prove it.

import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, posix } from "node:path";
import { gzipSync } from "node:zlib";

const SRC = process.argv[2] ?? "out-web4";
const DIST = process.argv[3] ?? "dist-web4";
const NAME = "fig-live-web4.tgz";
const MAX_BYTES = 2 * 1024 * 1024;
// 2026-10-21T00:00:00Z: the day Fig Live was built. Any constant works; it just has to be fixed.
const MTIME = 1792540800;

// Local-only files the web4 build must not ship (built from the watcher log on Terminal's machine).
const DROP = new Set(["uptime.json"]);

// Names that belong to Fig's own files in /workspace/public. Finding one means the export would
// overwrite Fig's kit releases or install guide, so stop.
export function forbiddenReason(path) {
  const parts = path.split("/");
  const base = parts[parts.length - 1];
  if (parts.includes("kit-files")) return "is under kit-files/";
  if (/\.sh$/i.test(base)) return "is a shell script (Fig's kit releases live beside this site)";
  if (base.toLowerCase() === "install.html") return "is install.html (Fig's own install guide)";
  if (base.toLowerCase() === "feedback.html") return "is feedback.html (Fig's own feedback page)";
  if (base.startsWith("._") || base === ".DS_Store") return "is macOS metadata";
  return null;
}

function walk(dir, rel = "") {
  const out = [];
  for (const name of readdirSync(join(dir, rel)).sort()) {
    const r = rel ? `${rel}/${name}` : name;
    const st = lstatSync(join(dir, r));
    if (st.isSymbolicLink()) throw new Error(`pack-web4: refusing to pack a symlink: ${r}`);
    if (st.isDirectory()) out.push({ path: `${r}/`, dir: true }, ...walk(dir, r));
    else if (st.isFile()) out.push({ path: r, dir: false });
    else throw new Error(`pack-web4: not a file or directory: ${r}`);
  }
  return out;
}

function octal(n, width) {
  // width includes the trailing NUL
  const s = n.toString(8);
  if (s.length > width - 1) throw new Error(`pack-web4: ${n} doesn't fit in a ${width}-byte tar field`);
  return s.padStart(width - 1, "0") + "\0";
}

function header(path, size, dir) {
  const h = Buffer.alloc(512, 0);
  let name = path;
  let prefix = "";
  if (Buffer.byteLength(name) > 100) {
    // ustar splits long paths at a slash: prefix (<=155) + "/" + name (<=100).
    const cut = path.lastIndexOf("/", path.length - (dir ? 2 : 1));
    if (cut <= 0) throw new Error(`pack-web4: path too long for ustar: ${path}`);
    prefix = path.slice(0, cut);
    name = path.slice(cut + 1);
    if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155) throw new Error(`pack-web4: path too long for ustar: ${path}`);
  }
  h.write(name, 0, 100, "utf8");
  h.write(octal(dir ? 0o755 : 0o644, 8), 100, 8, "ascii");
  h.write(octal(0, 8), 108, 8, "ascii"); // uid
  h.write(octal(0, 8), 116, 8, "ascii"); // gid
  h.write(octal(dir ? 0 : size, 12), 124, 12, "ascii");
  h.write(octal(MTIME, 12), 136, 12, "ascii");
  h.write("        ", 148, 8, "ascii"); // checksum placeholder: 8 spaces
  h.write(dir ? "5" : "0", 156, 1, "ascii");
  h.write("ustar\0", 257, 6, "ascii");
  h.write("00", 263, 2, "ascii");
  h.write("root", 265, 32, "ascii");
  h.write("root", 297, 32, "ascii");
  h.write(prefix, 345, 155, "utf8");
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8, "ascii");
  return h;
}

export function packTar(entries, readFile) {
  const blocks = [];
  for (const e of entries) {
    if (e.dir) {
      blocks.push(header(e.path, 0, true));
      continue;
    }
    const data = readFile(e.path);
    blocks.push(header(e.path, data.length, false), data);
    const pad = (512 - (data.length % 512)) % 512;
    if (pad) blocks.push(Buffer.alloc(pad, 0));
  }
  blocks.push(Buffer.alloc(1024, 0)); // two zero blocks end the archive
  let tar = Buffer.concat(blocks);
  const record = 10240; // pad to a whole tar record, like GNU tar and Python's tarfile
  if (tar.length % record) tar = Buffer.concat([tar, Buffer.alloc(record - (tar.length % record), 0)]);
  const gz = gzipSync(tar, { level: 9 });
  gz[9] = 3; // gzip "OS" byte: always Unix, so macOS and Linux packs match
  return gz;
}

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

// Everything in the export that goes into the tarball, sorted, minus the local-only files.
export function collect(src) {
  const all = walk(src);
  return { entries: all.filter((e) => !DROP.has(e.path)), dropped: all.filter((e) => DROP.has(e.path)) };
}

function main() {
  const { entries, dropped } = collect(SRC);
  const bad = entries.map((e) => [e.path, forbiddenReason(e.path)]).filter(([, why]) => why);
  if (bad.length) {
    for (const [p, why] of bad) console.error(`pack-web4: ${p} ${why}`);
    throw new Error("pack-web4: the export contains files that would overwrite Fig's own; not packing");
  }
  if (!entries.some((e) => e.path === "index.html")) throw new Error("pack-web4: no index.html in the export");
  // The Fig command uses these paths unquoted in the shell, so no spaces, quotes or glob characters.
  const unsafe = entries.filter((e) => !/^[A-Za-z0-9._\/-]+$/.test(e.path));
  if (unsafe.length) throw new Error(`pack-web4: paths the Fig command can't use unquoted: ${unsafe.map((e) => e.path).join(", ")}`);

  const read = (p) => readFileSync(join(SRC, p));
  const tgz = packTar(entries, read);
  const again = packTar(entries, read);
  if (!tgz.equals(again)) throw new Error("pack-web4: two packs of the same files differ; not reproducible");
  if (tgz.length > MAX_BYTES) throw new Error(`pack-web4: ${NAME} is ${tgz.length} bytes, over the ${MAX_BYTES}-byte limit`);

  const b64 = (tgz.toString("base64").match(/.{1,76}/g) ?? []).join("\n") + "\n";
  mkdirSync(DIST, { recursive: true });
  writeFileSync(join(DIST, NAME), tgz);
  writeFileSync(join(DIST, `${NAME}.b64`), b64);
  const sums = `${sha256(tgz)}  ${NAME}\n${sha256(Buffer.from(b64))}  ${NAME}.b64\n`;
  writeFileSync(join(DIST, "SHA256SUMS"), sums);

  const files = entries.filter((e) => !e.dir).length;
  console.log(`pack-web4: ${files} files, ${entries.length - files} directories${dropped.length ? `; left out ${dropped.map((d) => d.path).join(", ")} (local only)` : ""}`);
  console.log(`pack-web4: wrote ${posix.join(DIST, NAME)} (${tgz.length} bytes), ${NAME}.b64 (${b64.length} bytes), SHA256SUMS`);
  process.stdout.write(sums);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
