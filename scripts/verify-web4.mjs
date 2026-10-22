// Checks the web4 build the way it will run on Fig's GPU computer behind https://web-4.app/app/FIG/.
// Usage: npm run build:web4 && node scripts/verify-web4.mjs           (local, everything below)
//        node scripts/verify-web4.mjs --deploy-only                    (A, B and C only, no browser pages)
//        node scripts/verify-web4.mjs --live https://web-4.app/app/FIG/   (after a deploy: browser checks only)
//
// A. KIT PARITY: Fig's official kit repo (github.com/fig-the-fox/fig-kit) is the source of truth. Its release
//    commit and script fingerprints are vendored in scripts/fig-kit-release.json. src/content/kit.ts must have
//    one install line pointing at that commit, the main version's hash in it, sha256sum -c, no sudo and no
//    pipe to a shell, every receipt in the release map, and the kit cards the README lists.
// B. PACKAGE: dist-web4/fig-live-web4.tgz is <= 2 MB, matches SHA256SUMS and its .b64, repacks to the same
//    bytes, reads cleanly with the system tar AND Python's tarfile, has sorted entries, one fixed mtime,
//    root:root, and none of Fig's own file names (.sh, install.html, kit-files/), no uptime.json, no
//    macOS metadata and no local paths.
// C. DEPLOY: runs the exact one-line Fig command (scripts/fig-command.mjs) against a simulated
//    /workspace/public holding a stand-in old index.html plus fake copies of Fig's files, served by a local
//    stand-in for Fig's server. Fig's files must come through untouched and index.html must be backed up.
//    Then twice more: with Fig's server sending JS as text/plain (must roll back to the old index), and with a
//    wrong sha256 (must change nothing).
// D. BROWSER (390 and 1280 px, every page) through a local stand-in for Web4 (scripts/serve-web4.mjs:
//    /app/FIG/ mount, Web4's headers, its injected analytics tags as stubs, misses are 404 and logged):
//    no 404s or misses, right content-type per asset, no console errors, every link resolves, client-side
//    navigation stays under /app/FIG/, the install line is byte-identical to kit.ts's, no uptime strip.
//    Screenshots: docs/screens-web4/<page>-<width>.png. Plus the /app/<token id>/ alias, the back link
//    from Fig's install.html, and what today's 200-fallback does to a URL without its trailing slash.

import { chromium } from "playwright-core";
import { execFileSync, spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { CLAIM_LEAD, CLAIM_TITLE, COMING_NEXT, ASK_FIG_LABEL, INSTALL_LINE, KIT_STEPS, RENT_URL, VERSIONS } from "../src/content/kit.ts";
import { MAX_CHARS, figCommand, shaFromSums } from "./fig-command.mjs";
import { collect, forbiddenReason, packTar } from "./pack-web4.mjs";
import { ALIAS, FAKE_FIG_FILES, PREFIX, startServers, writeFakeFigFiles } from "./serve-web4.mjs";

// Where Terminal will host the .b64 (shape only; this run never fetches it).
const REAL_URL_SHAPE = "https://gist.githubusercontent.com/ownerownero/00000000000000000000000000000000/raw/fig-live-web4.tgz.b64";
const LIVE = process.argv.includes("--live") ? process.argv[process.argv.indexOf("--live") + 1] : null;
const RELEASE = JSON.parse(readFileSync(new URL("./fig-kit-release.json", import.meta.url), "utf8"));
// Stand-in for whatever index.html sat in /workspace/public before the deploy (the deploy must back it up and roll back to it).
const DEN = Buffer.from("<!doctype html><title>old index</title><p>Fig's previous page.</p>\n");
const DIST = "dist-web4";
const TGZ = join(DIST, "fig-live-web4.tgz");
const SHOTS = "docs/screens-web4";
const WIDTHS = [390, 1280];
const TOKEN_ID = "35e13b19-858d-480c-8779-ad25bc6f4d45";
const MINT = "CJ3M8Vj8xB65XvcUXvfMf8XmjxazMtUpgKZQtCiAweb4";
const PROJECT_URL = `https://web-4.app/project/${TOKEN_ID}`;
const PAGES = [
  { name: "home", path: "/", h1: `${CLAIM_TITLE.lead} ${CLAIM_TITLE.rest}`, title: "Fig Live" },
  { name: "kit", path: "/kit/", h1: "Use the kit", title: "Use the kit · Fig Live" },
  { name: "next", path: "/next/", h1: "What's next", title: "What's next · Fig Live" },
  { name: "receipts", path: "/receipts/", h1: "Receipts", title: "Receipts · Fig Live" },
];
// Links that leave the site. Anything else external fails the run.
const EXTERNAL_OK = [
  PROJECT_URL,
  RENT_URL,
  "https://x.com/AskFigFox",
  `https://dexscreener.com/solana/${MINT}`,
  /^https:\/\/dexscreener\.com\/solana\/[A-Za-z0-9]+$/, // the deepest pair, from DexScreener's own answer
];
// Facts the free-hour sheet says never to state (research/2026-10-21-free-gpu-hour-facts.md).
const NEVER_SAY = [/signature/i, /wallet permission/i, /guarantee/i, /\bH100\b|\bB200\b/, /\b2\s?M\b|2 million/i, /\b2\s?h(ours?)?\s+(a|per)\s+day/i, /\b\d[\d,]{2,}\s+(GPUs|computers)\b/i];
const LEAKS = ["/Users/", "/atlas/", "fig-watch", "log.jsonl", "watson"];

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures.push(msg);
};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");
const norm = (s) => (s ?? "").replace(/\s+/g, " ").trim();
// Fig's screen (the computer's screen_url, no /v1/). Used for the stated ORB exemption below.
const FRAME_URL = `https://web-4.app/api/public/machine/frame?id=35e13b19-858d-480c-8779-ad25bc6f4d45`;
const partition = (xs, f) => [xs.filter(f), xs.filter((x) => !f(x))];
const isApi = (u) => u.startsWith("https://web-4.app/api/") || u.startsWith("https://api.dexscreener.com/");

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

async function newContext(browser, width, origin) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    deviceScaleFactor: width < 500 ? 2 : 1,
    isMobile: width < 500,
    hasTouch: width < 500,
    colorScheme: "dark",
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin });
  return ctx;
}

// ---------- A. KIT PARITY ----------
async function denParity() {
  console.log(`\n== KIT PARITY (${RELEASE.repo} @ ${RELEASE.commit.slice(0, 12)}) ==`);
  // Codex review 10-22: every check below is exact. A fragment check let "sha256sum -c ; install" pass, a main
  // version taken from VERSIONS itself could be swapped, and prefix-matched cards let any command through.
  const main = VERSIONS.filter((v) => v.main);
  check(main.length === 1 && `fig-${main[0].version}.sh` === RELEASE.main, `exactly one version is marked main, and it is the release's main (${RELEASE.main})`);
  const want = `https://raw.githubusercontent.com/${RELEASE.repo}/${RELEASE.commit}/${RELEASE.main}`;
  const exact = `mkdir -p ~/.local/bin && curl -fsSL ${want} -o /tmp/fig.sh && echo "${RELEASE.sha256[RELEASE.main]}  /tmp/fig.sh" | sha256sum -c && install -m 755 /tmp/fig.sh ~/.local/bin/fig && export PATH="$HOME/.local/bin:$PATH"`;
  check(INSTALL_LINE === exact, `install line is exactly the release's: one URL (${RELEASE.main} at ${RELEASE.commit.slice(0, 12)}), its fingerprint, sha256sum -c && install`);
  check(!/\bsudo\b/.test(INSTALL_LINE) && !/\|\s*(ba|z)?sh\b/.test(INSTALL_LINE), "install line has no sudo and does not pipe to a shell");
  const files = VERSIONS.map((v) => `fig-${v.version}.sh`);
  const bad = VERSIONS.filter((v) => RELEASE.sha256[`fig-${v.version}.sh`] !== v.sha256).map((v) => v.version);
  const complete = new Set(files).size === files.length && [...files].sort().join() === Object.keys(RELEASE.sha256).sort().join();
  check(bad.length === 0 && complete, `receipts are exactly the release's ${Object.keys(RELEASE.sha256).length} versions, each once, each with its own fingerprint${bad.length ? `; wrong: ${bad.join(", ")}` : ""}${complete ? "" : "; missing or duplicated versions"}`);
  const ours = KIT_STEPS.flatMap((s) => s.commands).map((c) => ({ code: c.command, text: c.body.map((p) => (typeof p === "string" ? p : p.code)).join("") }));
  check(JSON.stringify(ours) === JSON.stringify(RELEASE.cards), `kit cards are exactly the reviewed ones in fig-kit-release.json (${RELEASE.cards.map((c) => c.code).join(", ")})`);
  return { pre: INSTALL_LINE, cards: ours, rows: VERSIONS.map((v) => [`${v.version}${v.main ? " (main)" : ""}`, v.sha256]), count: ours.length };
}

// ---------- B. PACKAGE ----------
function packageChecks() {
  console.log("\n== PACKAGE (dist-web4) ==");
  const tgz = readFileSync(TGZ);
  const b64 = readFileSync(`${TGZ}.b64`, "utf8");
  const sums = readFileSync(join(DIST, "SHA256SUMS"), "utf8");
  check(tgz.length <= 2 * 1024 * 1024, `tarball is ${(tgz.length / 1024 / 1024).toFixed(2)} MB (limit 2 MB)`);
  check(sums.includes(`${sha256(tgz)}  fig-live-web4.tgz\n`), `SHA256SUMS has the tarball's sha256 ${sha256(tgz)}`);
  check(sums.includes(`${sha256(Buffer.from(b64))}  fig-live-web4.tgz.b64\n`), "SHA256SUMS has the .b64's sha256");
  check(Buffer.from(b64.replace(/\n/g, ""), "base64").equals(tgz), ".b64 decodes to the exact tarball");
  const decoded = spawnSync("base64", ["-d", "-i", `${TGZ}.b64`], { maxBuffer: 16 * 1024 * 1024 }).stdout;
  check(Buffer.isBuffer(decoded) && decoded.equals(tgz), "system base64 -d gives the exact tarball too");

  if (existsSync("out-web4")) {
    const { entries } = collect("out-web4");
    check(packTar(entries, (p) => readFileSync(join("out-web4", p))).equals(tgz), "repacking out-web4/ gives byte-identical output (reproducible)");
  } else check(false, "out-web4/ missing; run npm run build:web4 first");

  // Two independent readers: the system tar (bsdtar here; GNU tar on Fig's machine) and Python's tarfile.
  const list = execFileSync("tar", ["-tzf", TGZ], { encoding: "utf8" }).trim().split("\n");
  const py = JSON.parse(
    execFileSync(
      "python3",
      ["-I", "-c", "import json,sys,tarfile\nt=tarfile.open(sys.argv[1],'r:gz')\nprint(json.dumps([[m.name,m.mtime,m.uid,m.gid,m.uname,m.gname,oct(m.mode),m.type.decode()] for m in t.getmembers()]))", TGZ],
      { encoding: "utf8" },
    ),
  );
  const names = py.map((m) => m[0]);
  check(list.length === py.length && list.every((n, i) => n.replace(/\/$/, "") === names[i]), `system tar and Python's tarfile list the same ${py.length} entries`);
  // Depth-first, each directory's entries by name (GNU tar --sort=name order): compare path components.
  const cmpPath = (a, b) => {
    const x = a.replace(/\/$/, "").split("/");
    const y = b.replace(/\/$/, "").split("/");
    for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
    return x.length - y.length;
  };
  check(list.every((n, i) => i === 0 || cmpPath(list[i - 1], n) < 0), "entries are sorted (each directory before its contents, names in order)");
  check(new Set(py.map((m) => m[1])).size === 1, `every entry has the same fixed mtime (${new Date(py[0][1] * 1000).toISOString()})`);
  check(py.every((m) => m[2] === 0 && m[3] === 0 && m[4] === "root" && m[5] === "root"), "every entry is owned by root:root");
  check(py.every((m) => (m[7] === "5" ? m[6] === "0o755" : m[7] === "0" && m[6] === "0o644")), "only plain files (0644) and directories (0755): no links, devices or pax headers");
  const forbidden = list.map((n) => [n, forbiddenReason(n.replace(/\/$/, ""))]).filter(([, w]) => w);
  check(forbidden.length === 0, `no fig-v*.sh / *.sh, install.html, feedback.html, kit-files/ or macOS ._ files${forbidden.length ? `: ${forbidden.map((f) => f[0]).join(", ")}` : ""}`);
  check(!list.some((n) => /(^|\/)uptime\.json$/.test(n)), "no uptime.json (built from Terminal's local watcher log)");
  check(list.every((n) => /^[A-Za-z0-9._\/-]+$/.test(n)), "every path is plain [A-Za-z0-9._/-], safe unquoted in the Fig command");
  for (const p of ["index.html", "kit/index.html", "next/index.html", "receipts/index.html", "fig.webp"]) check(list.includes(p), `has ${p}`);

  const tmp = mkdtempSync(join(tmpdir(), "fig-live-web4-pkg-"));
  execFileSync("tar", ["-xzf", TGZ, "-C", tmp]);
  const leaks = [];
  const walk = (d) => {
    for (const n of readdirSync(join(tmp, d))) {
      const r = d ? `${d}/${n}` : n;
      if (lstatSync(join(tmp, r)).isDirectory()) walk(r);
      else if (/\.(html|txt|js|css|json)$/.test(n)) {
        const text = readFileSync(join(tmp, r), "utf8");
        for (const l of LEAKS) if (text.includes(l)) leaks.push(`${r}: ${l}`);
        if (/\.(html|txt)$/.test(n) && /Last 24 hours|uptime\.json/.test(text)) leaks.push(`${r}: uptime strip`);
        if (/\.(html|txt)$/.test(n) && /(href|src)="\/(?!app\/FIG\/)/.test(text)) leaks.push(`${r}: root path without /app/FIG`);
      }
    }
  };
  walk("");
  rmSync(tmp, { recursive: true, force: true });
  check(leaks.length === 0, `no local paths, uptime strip or unprefixed root paths in any page or asset${leaks.length ? `: ${leaks.slice(0, 6).join(" | ")}` : ""}`);
}

// ---------- C. DEPLOY with the real Fig command ----------
function seedPublic() {
  const dir = mkdtempSync(join(tmpdir(), "fig-live-workspace-"));
  const pub = join(dir, "public");
  mkdirSync(pub);
  writeFileSync(join(pub, "index.html"), DEN);
  writeFakeFigFiles(pub);
  return pub;
}

function figFileState(pub) {
  const out = {};
  for (const rel of Object.keys(FAKE_FIG_FILES)) out[rel] = sha256(readFileSync(join(pub, rel)));
  out["fig.sh -> "] = lstatSync(join(pub, "fig.sh")).isSymbolicLink() ? readlinkSync(join(pub, "fig.sh")) : "not a symlink";
  return out;
}

// Serves the .b64 files the Fig command downloads: name -> local path.
function hostDist(port, files) {
  const server = createServer((req, res) => {
    const file = files[new URL(req.url, "http://x").pathname.slice(1)];
    if (!file) return res.writeHead(404).end();
    res.writeHead(200, { "content-type": "text/plain" }).end(readFileSync(file));
  });
  return new Promise((ok) => server.listen(port, "127.0.0.1", () => ok(server)));
}

// A second release for the update tests: the real tarball with a marker added to every page.
function makeReleaseB() {
  const dir = mkdtempSync(join(tmpdir(), "fig-live-release-b-"));
  const site = join(dir, "site");
  mkdirSync(site);
  execFileSync("tar", ["-xzf", TGZ, "-C", site]);
  for (const page of ["index.html", "kit/index.html", "next/index.html", "receipts/index.html"]) {
    writeFileSync(join(site, page), readFileSync(join(site, page), "utf8").replace("</body>", "<!-- TEST release B --></body>"));
  }
  // Not just HTML: navigation payloads, a stylesheet and an image with stable names change too,
  // and one file is new (a rollback leaves new files behind; nothing links to them).
  for (const f of ["index.txt", "kit/index.txt", readdirSync(join(site, "_next/static/css")).map((n) => `_next/static/css/${n}`)[0]]) {
    writeFileSync(join(site, f), `${readFileSync(join(site, f), "utf8")}\n/* TEST release B */\n`);
  }
  writeFileSync(join(site, "fig.webp"), Buffer.concat([readFileSync(join(site, "fig.webp")), Buffer.from("TEST release B")]));
  const added = "_next/static/chunks/test-release-b-new.js";
  writeFileSync(join(site, added), "/* TEST release B: a file that only exists in release B */\n");
  const tgz = packTar(collect(site).entries, (p) => readFileSync(join(site, p)));
  const b64 = join(dir, "b.tgz.b64");
  writeFileSync(b64, tgz.toString("base64") + "\n");
  return { b64, sha: sha256(tgz), added: [added] };
}

// Every file under public/ with its sha256, minus the dated index backups the command keeps on purpose.
function snapshot(pub) {
  const out = {};
  const walk = (rel) => {
    for (const n of readdirSync(join(pub, rel))) {
      const r = rel ? `${rel}/${n}` : n;
      const st = lstatSync(join(pub, r));
      if (st.isSymbolicLink()) out[r] = `-> ${readlinkSync(join(pub, r))}`;
      else if (st.isDirectory()) walk(r);
      else if (!/^index\.fig-backup-\d+\.html$/.test(r)) out[r] = sha256(readFileSync(join(pub, r)));
    }
  };
  walk("");
  return out;
}
// Files that differ between two snapshots; `allowNew` lists files that may exist only in the second one.
const diffSnap = (a, b, allowNew = []) =>
  [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k] && !(a[k] === undefined && allowNew.includes(k))).sort();

// Fig's computer runs Linux with GNU coreutils. macOS's own sha256sum can't read a check list from stdin,
// so where Homebrew's GNU coreutils exist (g-prefixed), a PATH shim puts them first under their plain
// names. find, tar, grep and curl stay the system ones (BSD find/tar here; the flags used are POSIX).
const GNU = ["sha256sum", "base64", "cp", "mv", "mktemp", "date", "head", "ls", "test"];
function gnuShim() {
  const dir = mkdtempSync(join(tmpdir(), "fig-live-gnu-"));
  const have = [];
  for (const t of GNU) {
    const g = spawnSync("sh", ["-c", `command -v g${t}`], { encoding: "utf8" }).stdout.trim();
    if (g) {
      symlinkSync(g, join(dir, t));
      have.push(t);
    }
  }
  return { dir, have };
}
let shim;
// Async on purpose: the stand-in servers live in this process, so a blocking spawnSync would deadlock curl.
function runFig(cmd, shell = "bash", env = {}) {
  shim ??= gnuShim();
  return new Promise((resolve) => {
    const child = spawn(shell, ["-c", cmd], { env: { ...process.env, PATH: `${shim.dir}:${process.env.PATH}`, ...env }, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGKILL"), 120_000);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, out });
    });
  });
}

async function deployChecks() {
  console.log("\n== DEPLOY (the exact Fig command, against a simulated /workspace/public) ==");
  const sha = shaFromSums(join(DIST, "SHA256SUMS"));
  const prod = figCommand({ url: "https://HOST/PATH/fig-live-web4.tgz.b64", sha256: sha });
  check(prod.length <= MAX_CHARS && !prod.includes("\n"), `Fig command is one line, ${prod.length} characters with a placeholder URL (limit ${MAX_CHARS})`);
  const real = figCommand({ url: REAL_URL_SHAPE, sha256: sha });
  check(real.length <= 860 && !real.includes("\n"), `with the real URL shape (${REAL_URL_SHAPE.length} characters) the command is ${real.length} characters (limit 860)`);
  const releaseB = makeReleaseB();
  const dist = await hostDist(3443, { "fig-live-web4.tgz.b64": `${TGZ}.b64`, "b.tgz.b64": releaseB.b64 });
  const body = (c) => c.slice(c.indexOf("k(){"));

  // 1. The happy path.
  const pub = seedPublic();
  const before = figFileState(pub);
  let s = await startServers({ root: pub, port: 3441, figPort: 3442 });
  const cmd = figCommand({ url: "http://127.0.0.1:3443/fig-live-web4.tgz.b64", sha256: sha, publicDir: pub, server: s.figBase.replace(/^http:\/\//, "") });
  check(body(cmd) === body(prod), "the tested command differs from Fig's only in the U/P/H assignments at the front");
  const r = await runFig(cmd);
  console.log(`      ran with GNU ${shim.have.join(", ") || "(none found)"}; system find, tar, grep, curl`);
  check(shim.have.includes("sha256sum") && shim.have.includes("base64"), "GNU sha256sum and base64 were used, as on Fig's machine");
  check(r.code === 0 && r.out.includes("f.tgz: OK") && r.out.includes("FIG-LIVE-OK"), `Fig command: sha256 check OK, post-checks OK, exit ${r.code}${r.code ? `\n${r.out}` : ""}`);
  const after = figFileState(pub);
  check(JSON.stringify(after) === JSON.stringify(before), "Fig's install.html, feedback.html, fig-v0.2.2.sh, fig.sh (still a symlink) and kit-files/ are byte-for-byte untouched");
  const backups = readdirSync(pub).filter((n) => /^index\.fig-backup-\d+\.html$/.test(n));
  check(backups.length === 1 && readFileSync(join(pub, backups[0])).equals(DEN), `old index.html (the previous index) backed up as ${backups[0]}`);
  const tmp = mkdtempSync(join(tmpdir(), "fig-live-web4-cmp-"));
  execFileSync("tar", ["-xzf", TGZ, "-C", tmp]);
  check(readFileSync(join(pub, "index.html")).equals(readFileSync(join(tmp, "index.html"))), "index.html is now Fig Live's home page");
  rmSync(tmp, { recursive: true, force: true });
  const leftovers = Object.keys(snapshot(pub)).filter((f) => f.endsWith(".flb"));
  check(leftovers.length === 0, `no backup copies (*.flb) left in public/ after a good deploy${leftovers.length ? `: ${leftovers.join(", ")}` : ""}`);
  await s.close();

  // 4. Updating an installed release, and the check fails (here: JS served as text/plain). Everything the
  //    update replaced must come back, not just index.html, or visitors get a mix of the two releases.
  const urlA = "http://127.0.0.1:3443/fig-live-web4.tgz.b64";
  const urlB = "http://127.0.0.1:3443/b.tgz.b64";
  const pubU = seedPublic();
  s = await startServers({ root: pubU, port: 3441, figPort: 3442 });
  const rA = await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubU, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  const releaseA = snapshot(pubU);
  s = await startServers({ root: pubU, port: 3441, figPort: 3442, figMime: { ".html": "text/html", ".css": "text/css", ".js": "text/plain" } });
  const rU = await runFig(figCommand({ url: urlB, sha256: releaseB.sha, publicDir: pubU, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  const mixed = diffSnap(releaseA, snapshot(pubU), releaseB.added);
  check(rA.code === 0 && rU.code === 1 && rU.out.includes("FIG-LIVE-ROLLED-BACK") && mixed.length === 0, `update whose check fails: every replaced file is restored to the installed release (exit ${rU.code})${mixed.length ? `; differs: ${mixed.join(", ")}` : ""}`);

  // 5. Updating, and the copy itself fails part-way (here: one page directory can't be written; on Fig's
  //    machine it could be a full disk). The rollback must still run.
  const pubC = seedPublic();
  s = await startServers({ root: pubC, port: 3441, figPort: 3442 });
  await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubC, server: s.figBase.replace(/^http:\/\//, "") }));
  const installed = snapshot(pubC);
  // Read-only file AND directory: neither overwriting receipts/index.html nor renaming it aside can work.
  chmodSync(join(pubC, "receipts/index.html"), 0o444);
  chmodSync(join(pubC, "receipts"), 0o555);
  const rC = await runFig(figCommand({ url: urlB, sha256: releaseB.sha, publicDir: pubC, server: s.figBase.replace(/^http:\/\//, "") }));
  chmodSync(join(pubC, "receipts"), 0o755);
  chmodSync(join(pubC, "receipts/index.html"), 0o644);
  await s.close();
  const mixedC = diffSnap(installed, snapshot(pubC), releaseB.added);
  check(rC.code !== 0 && rC.out.includes("FIG-LIVE-ROLLED-BACK") && mixedC.length === 0, `update whose copy fails part-way: rollback runs and the installed release is intact (exit ${rC.code})${mixedC.length ? `; differs: ${mixedC.join(", ")}` : ""}`);

  // 1b. The same under dash (Ubuntu's /bin/sh), in case Fig's agent runs it with sh -c: install, then an
  //     update whose check fails and must roll back.
  if (existsSync("/bin/dash")) {
    const pubD = seedPublic();
    s = await startServers({ root: pubD, port: 3441, figPort: 3442 });
    const rD = await runFig(figCommand({ url: "http://127.0.0.1:3443/fig-live-web4.tgz.b64", sha256: sha, publicDir: pubD, server: s.figBase.replace(/^http:\/\//, "") }), "/bin/dash");
    await s.close();
    const installedD = snapshot(pubD);
    s = await startServers({ root: pubD, port: 3441, figPort: 3442, figMime: { ".html": "text/html", ".css": "text/css", ".js": "text/plain" } });
    const rD2 = await runFig(figCommand({ url: "http://127.0.0.1:3443/b.tgz.b64", sha256: releaseB.sha, publicDir: pubD, server: s.figBase.replace(/^http:\/\//, "") }), "/bin/dash");
    await s.close();
    const mixedD = diffSnap(installedD, snapshot(pubD), releaseB.added);
    check(rD.code === 0 && rD.out.includes("FIG-LIVE-OK") && rD2.code === 1 && rD2.out.includes("FIG-LIVE-ROLLED-BACK") && mixedD.length === 0, `under dash too: installs (exit ${rD.code}), and a failed update rolls back cleanly (exit ${rD2.code})${mixedD.length ? `; differs: ${mixedD.join(", ")}` : ""}`);
  } else console.log("      (no /bin/dash here; dash run skipped)");

  // 6. Stray *.flb names that aren't this run's backups (inside Fig's kit-files/, and a directory whose
  //    name ends in .flb) must survive both a good update and a rolled-back one, and Fig's script must
  //    never be overwritten by one of them.
  const strays = (pubX) => {
    writeFileSync(join(pubX, "kit-files/fig-v0.2.2.sh.flb"), "STALE: not this run's backup\n");
    mkdirSync(join(pubX, "kit-files/cache.flb"), { recursive: true });
    writeFileSync(join(pubX, "kit-files/cache.flb/keep"), "keep\n");
  };
  const pubS = seedPublic();
  s = await startServers({ root: pubS, port: 3441, figPort: 3442 });
  await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubS, server: s.figBase.replace(/^http:\/\//, "") }));
  strays(pubS);
  const beforeS = snapshot(pubS);
  const rS = await runFig(figCommand({ url: urlB, sha256: releaseB.sha, publicDir: pubS, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  const afterS = snapshot(pubS);
  const figKept = Object.keys(beforeS).filter((k) => k.startsWith("kit-files/")).every((k) => afterS[k] === beforeS[k]);
  check(rS.code === 0 && rS.out.includes("FIG-LIVE-OK") && figKept, `good update with stray .flb files in Fig's kit-files/: succeeds and leaves all of kit-files/ untouched (exit ${rS.code})`);
  s = await startServers({ root: pubS, port: 3441, figPort: 3442, figMime: { ".html": "text/html", ".css": "text/css", ".js": "text/plain" } });
  const installedS = snapshot(pubS);
  const rS2 = await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubS, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  const mixedS = diffSnap(installedS, snapshot(pubS));
  check(rS2.code === 1 && rS2.out.includes("FIG-LIVE-ROLLED-BACK") && mixedS.length === 0, `rolled-back update with stray .flb files: everything, Fig's kit-files/ included, is as before (exit ${rS2.code})${mixedS.length ? `; differs: ${mixedS.join(", ")}` : ""}`);

  // 7. The rollback itself can't finish (a page directory turns read-only during the check): the command
  //    must say so, not claim it rolled back.
  const pubR = seedPublic();
  s = await startServers({ root: pubR, port: 3441, figPort: 3442 });
  await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubR, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  s = await startServers({
    root: pubR,
    port: 3441,
    figPort: 3442,
    figMime: { ".html": "text/html", ".css": "text/css", ".js": "text/plain" },
    onFigRequest: (path) => path === "/kit/" && chmodSync(join(pubR, "receipts"), 0o555),
  });
  const rR = await runFig(figCommand({ url: urlB, sha256: releaseB.sha, publicDir: pubR, server: s.figBase.replace(/^http:\/\//, "") }));
  chmodSync(join(pubR, "receipts"), 0o755);
  await s.close();
  check(rR.code !== 0 && !rR.out.includes("FIG-LIVE-ROLLED-BACK") && rR.out.includes("FIG-LIVE-ROLLBACK-FAILED"), `rollback that can't finish reports FIG-LIVE-ROLLBACK-FAILED, never FIG-LIVE-ROLLED-BACK (exit ${rR.code})`);

  // 8. A leftover file from an older build sorts before chunks/ and is served fine, but the real chunks
  //    come back as text/plain: the check must look at an app chunk, so this rolls back.
  const pubM = seedPublic();
  mkdirSync(join(pubM, "_next/static/a-old-build"), { recursive: true });
  writeFileSync(join(pubM, "_next/static/a-old-build/_buildManifest.js"), "/* TEST: leftover from an older build */\n");
  s = await startServers({ root: pubM, port: 3441, figPort: 3442, figTypeFor: (path) => (path.startsWith("/_next/static/chunks/") ? "text/plain" : null) });
  const rM = await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubM, server: s.figBase.replace(/^http:\/\//, "") }));
  await s.close();
  check(rM.code === 1 && rM.out.includes("FIG-LIVE-ROLLED-BACK") && readFileSync(join(pubM, "index.html")).equals(DEN), `JS check looks at an app chunk, not a leftover manifest: chunks served as text/plain roll back (exit ${rM.code})`);

  // 9. mktemp fails (bad TMPDIR): the command must stop, not fall back to $HOME and write there.
  const pubT = seedPublic();
  const fakeHome = mkdtempSync(join(tmpdir(), "fig-live-home-"));
  s = await startServers({ root: pubT, port: 3441, figPort: 3442 });
  const rT = await runFig(figCommand({ url: urlA, sha256: sha, publicDir: pubT, server: s.figBase.replace(/^http:\/\//, "") }), "bash", { TMPDIR: join(fakeHome, "no-such-dir"), HOME: fakeHome });
  await s.close();
  const homeFiles = readdirSync(fakeHome);
  check(rT.code !== 0 && homeFiles.length === 0 && readFileSync(join(pubT, "index.html")).equals(DEN), `mktemp failure stops the command before it downloads anything or touches public/ (exit ${rT.code}; files in HOME: ${homeFiles.join(", ") || "none"})`);

  // 2. Fig's server sends JS as text/plain (with Web4's nosniff, browsers would refuse it): roll back.
  const pub2 = seedPublic();
  s = await startServers({ root: pub2, port: 3441, figPort: 3442, figMime: { ".html": "text/html", ".css": "text/css", ".js": "text/plain" } });
  const r2 = await runFig(figCommand({ url: "http://127.0.0.1:3443/fig-live-web4.tgz.b64", sha256: sha, publicDir: pub2, server: s.figBase.replace(/^http:\/\//, "") }));
  check(r2.code === 1 && r2.out.includes("FIG-LIVE-ROLLED-BACK") && readFileSync(join(pub2, "index.html")).equals(DEN), `wrong JS content-type on Fig's server: command rolls back to the old index and fails (exit ${r2.code})`);
  await s.close();

  // 3. A tampered or truncated download: nothing changes.
  const pub3 = seedPublic();
  s = await startServers({ root: pub3, port: 3441, figPort: 3442 });
  const r3 = await runFig(figCommand({ url: "http://127.0.0.1:3443/fig-live-web4.tgz.b64", sha256: "0".repeat(64), publicDir: pub3, server: s.figBase.replace(/^http:\/\//, "") }));
  check(r3.code === 1 && r3.out.includes("f.tgz: FAILED") && readFileSync(join(pub3, "index.html")).equals(DEN) && !existsSync(join(pub3, "_next")), `sha256 mismatch: command stops before touching public/ (exit ${r3.code})`);
  await s.close();
  dist.close();
  return pub;
}

// ---------- D. BROWSER ----------
function watch(page, origin) {
  const log = { bad: [], failed: [], errors: [], sameOrigin: [], api: [] };
  const want = { script: /javascript/, stylesheet: /^text\/css/, font: /^font\/woff2/, image: /^image\//, document: /^text\/html/ };
  page.on("response", (r) => {
    const u = r.url();
    if (!u.startsWith(origin)) return;
    const path = new URL(u).pathname;
    log.sameOrigin.push(path);
    const type = r.headers()["content-type"] ?? "";
    const kind = r.request().resourceType();
    if (r.status() >= 400) log.bad.push(`${r.status()} ${path}`);
    else if (want[kind] && !want[kind].test(type)) log.bad.push(`${kind} ${path} came back as ${type}`);
    else if (kind === "fetch" && path.endsWith(".txt") && !/^text\/plain/.test(type)) log.bad.push(`RSC payload ${path} came back as ${type}`);
  });
  page.on("request", (r) => isApi(r.url()) && log.api.push(r.url()));
  page.on("requestfailed", (r) => log.failed.push({ url: r.url(), why: r.failure()?.errorText ?? "" }));
  page.on("console", (m) => m.type() === "error" && log.errors.push(`${m.text()}${m.location()?.url ? ` @ ${new URL(m.location().url).pathname}` : ""}`));
  page.on("pageerror", (e) => log.errors.push(String(e)));
  return log;
}

async function browserSuite(browser, { origin, misses, den, shots, stubs }) {
  const prefixed = (p) => `${origin}${PREFIX}${p}`;
  const takeMisses = async () => (misses ? await (await fetch(misses)).json() : []);
  const linkSeen = new Map();
  await takeMisses();

  for (const w of WIDTHS) {
    console.log(`\n== BROWSER @ ${w}px (${origin}${PREFIX}/) ==`);
    const ctx = await newContext(browser, w, origin);
    for (const pg of PAGES) {
      const page = await ctx.newPage();
      const log = watch(page, origin);
      await page.goto(prefixed(pg.path), { waitUntil: "domcontentloaded" });
      if (pg.name === "home") {
        await page.waitForSelector('#status[data-settled="yes"]', { timeout: 20_000 }).catch(() => {});
        await page.waitForFunction(() => document.querySelectorAll("#now ol li").length > 0, null, { timeout: 15_000 }).catch(() => {});
      }
      await page.waitForLoadState("networkidle").catch(() => {});
      if (pg.name !== "home") await page.waitForTimeout(1200);
      const tag = `${w}px ${pg.name}`;
      const info = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
        title: document.title,
        text: document.body.innerText,
        // Our own copy only: Fig's live thoughts and Web4's raw status are untrusted upstream text.
        ownText: (() => {
          const c = document.body.cloneNode(true);
          c.querySelectorAll("#now ol, #status").forEach((n) => n.remove());
          return c.textContent ?? "";
        })(),
        nav: [...document.querySelectorAll('nav[aria-label="Pages"] a')].map((a) => ({ href: a.getAttribute("href"), current: a.getAttribute("aria-current") })),
        links: [...document.querySelectorAll("a[href]")].map((a) => ({ href: a.href, raw: a.getAttribute("href"), text: a.textContent?.trim() })),
        stubs: window.__web4Stubs ?? [],
        injected: !!document.querySelector('script[src="/~flock.js"]'),
        levels: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      }));
      const missed = await takeMisses();

      check(info.h1 === pg.h1 && info.title === pg.title, `${tag}: h1 "${info.h1}" · title "${info.title}"`);
      check(log.bad.length === 0, `${tag}: every same-origin response is 2xx/3xx with the right content-type (${log.sameOrigin.length} requests)${log.bad.length ? `: ${log.bad.join(" | ")}` : ""}`);
      check(missed.length === 0, `${tag}: the server saw no request for a missing file${missed.length ? `: ${missed.map((m) => `${m.path} (${m.why})`).join(", ")}` : ""}`);
      const stray = log.sameOrigin.filter((p) => !p.startsWith(`${PREFIX}/`) && !/^\/(~flock\.js|__l5e\/|~api\/analytics\/)/.test(p));
      check(stray.length === 0, `${tag}: every same-origin request stays under ${PREFIX}/ (apart from Web4's own analytics)${stray.length ? `: ${stray.join(", ")}` : ""}`);
      check(log.errors.length === 0, `${tag}: no console errors or CSP violations${log.errors.length ? `: ${log.errors.join(" | ")}` : ""}`);
      // Explained: Fig's live-screen <img> is cross-origin in this local test (on Web4 it's same-origin). When
      // Web4 has no frame it answers 404 with an HTML body, and Chrome's ORB blocks that cross-origin.
      const [orb, failed] = partition(log.failed, (f) => f.url.startsWith(FRAME_URL) && f.why.includes("ERR_BLOCKED_BY_ORB"));
      check(failed.length === 0, `${tag}: no failed requests${failed.length ? `: ${failed.map((f) => `${f.url} (${f.why})`).join(", ")}` : ""}`);
      if (orb.length) {
        const live = await fetch(`${FRAME_URL}&t=verify-${Date.now()}`, { headers: { "user-agent": "Mozilla/5.0 (fig-live verify-web4)" } });
        const shown = await page.locator("#now").innerText();
        console.log(`      NOTE  ${orb.length} live-screen frame request(s) blocked by ORB: Web4's frame endpoint answers ${live.status} ${live.headers.get("content-type")} right now (no screen), and the image is cross-origin only in this local test`);
        check(/isn.t showing right now|Paused/.test(shown), `${tag}: with no frame from Web4, the page shows its no-screen card instead of a broken image`);
      }
      if (stubs) check(info.injected && info.stubs.length === 2, `${tag}: Web4's two injected scripts (stubs) load under the page's CSP and React hydrates around them`);
      const current = info.nav.filter((n) => n.current === "page");
      check(info.nav.length === 4 && info.nav.every((n) => n.href.startsWith(`${PREFIX}/`) && n.href.endsWith("/")) && current.length === 1 && current[0].href === `${PREFIX}${pg.path}`, `${tag}: nav has 4 links under ${PREFIX}/ with trailing slashes, this page marked current`);
      const skip = info.levels.findIndex((l, i) => i > 0 && l > info.levels[i - 1] + 1);
      check(info.levels[0] === 1 && skip === -1, `${tag}: heading levels start at h1 and never skip (${info.levels.join(",")})`);
      check(info.overflow <= 0, `${tag}: no horizontal scroll (${info.overflow}px)`);
      const said = NEVER_SAY.filter((re) => re.test(info.ownText)).map(String);
      check(said.length === 0, `${tag}: none of the never-say claims (signature, 2M = 2h, guarantees, GPU counts, H100/B200)${said.length ? `: ${said.join(", ")}` : ""}`);
      check(/Web4, which hosts it, adds its own analytics/.test(info.text), `${tag}: footer says Web4 adds its own analytics (no "no tracking" claim on Web4)`);
      if (pg.name === "home" || pg.name === "kit") {
        const fb = info.links.filter((l) => l.href === "https://x.com/AskFigFox");
        check(fb.length >= 1 && /Feedback/.test(info.text), `${tag}: Feedback section links Fig on X (${fb.length}×)`);
      }
      if (pg.name === "home" || pg.name === "kit") {
        const chat = info.links.filter((l) => l.text === ASK_FIG_LABEL);
        check(chat.length >= 1 && chat.every((l) => l.href === "https://x.com/AskFigFox"), `${tag}: "${ASK_FIG_LABEL}" links to Fig on X (${chat.length}×)`);
      }
      check(!/holder chat/i.test(info.text) && !info.links.some((l) => l.raw?.includes("web-4.app/app/FIG") || l.href.includes("web-4.app/app/FIG")), `${tag}: no holder chat, no dead web-4.app/app/FIG links`);

      for (const l of info.links) {
        const u = new URL(l.href);
        if (u.origin === origin) {
          const path = u.pathname;
          const key = `${path}${u.search}`;
          if (!linkSeen.has(key)) {
            const res = await fetch(`${origin}${key}`, { headers: { "user-agent": "Mozilla/5.0 (fig-live verify-web4)" } });
            const ok = path.startsWith(`${PREFIX}/`) && res.status === 200 && (await takeMisses()).length === 0;
            linkSeen.set(key, ok);
          }
        } else if (!linkSeen.has(l.href)) {
          linkSeen.set(l.href, u.protocol === "https:" && EXTERNAL_OK.some((x) => (typeof x === "string" ? x === l.href : x.test(l.href))));
        }
      }

      if (pg.name === "home") {
        const home = await page.evaluate(() => {
          const hero = document.querySelector("section[aria-labelledby=hero-title]");
          return {
            hero: hero?.innerText ?? "",
            heroLinks: [...(hero?.querySelectorAll("a") ?? [])].map((a) => [a.textContent?.trim(), a.getAttribute("href")]),
            uptime: !!document.querySelector("section[aria-labelledby=uptime-title]") || document.body.innerText.includes("Last 24 hours"),
            mood: document.querySelector("#status")?.getAttribute("data-mood"),
            thoughts: document.querySelectorAll("#now ol li").length,
          };
        });
        check(home.hero.includes(CLAIM_LEAD) && /How to claim it/i.test(home.hero) && home.hero.includes("SSH public key") && home.hero.includes("Rent free"), `${tag}: hero leads with the free GPU hour and a short how-to-claim`);
        check(
          home.heroLinks.length === 2 && home.heroLinks.some(([t, h]) => t === "Use the kit" && h === `${PREFIX}/kit/`) && home.heroLinks.some(([t, h]) => t === "web-4.app/rent" && h === RENT_URL),
          `${tag}: hero links are exactly "Use the kit" (${PREFIX}/kit/) and web-4.app/rent`,
        );
        check(!home.uptime && !log.sameOrigin.some((p) => p.includes("uptime")), `${tag}: no uptime strip and no uptime.json request`);
        check(home.mood && home.mood !== "unreachable" && home.thoughts >= 3, `${tag}: live status from Web4 renders (${home.mood}, ${home.thoughts} thoughts)`);
        check(log.api.some((u) => u.startsWith("https://web-4.app/api/public/v1/")), `${tag}: API calls stay absolute to https://web-4.app/api/public/v1 (same-origin on Web4)`);
        if (home.mood === "awake" || home.mood === "idle") {
          await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => i.src.includes("machine/frame") && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => {});
          const shown = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame") && i.naturalWidth > 0).map((i) => i.src));
          // Compare with what the API says screen_url is right now; only the page's refresh parameter may be added.
          const api = await (await fetch(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}`, { headers: { "user-agent": "Mozilla/5.0 (fig-live verify-web4)" } })).json();
          const fromApi = (u) => {
            const x = new URL(u);
            x.searchParams.delete("t");
            return typeof api.screen_url === "string" && x.toString() === new URL(api.screen_url).toString();
          };
          check(shown.length > 0 && shown.every(fromApi) && !log.api.some((u) => u.includes("/v1/machine/frame")), `${tag}: Fig is ${home.mood}, and its real screen loads from the API's screen_url (no /v1/ frame request)`);
        }
      } else {
        check(log.api.length === 0, `${tag}: static page, no API calls`);
      }

      if (pg.name === "kit") {
        const kit = await page.evaluate(() => ({
          pre: document.getElementById("install-line")?.textContent ?? "",
          cards: [...document.querySelectorAll("[data-kit-card]")].map((c) => [...c.querySelectorAll("p")].map((p) => p.textContent ?? "")),
          guide: document.querySelector("a[data-install-guide]")?.getAttribute("href"),
          guideText: document.querySelector("a[data-install-guide]")?.textContent,
          steps: document.querySelectorAll("main ol > li").length,
        }));
        check(Buffer.from(kit.pre, "utf8").equals(Buffer.from(den.pre, "utf8")), `${tag}: install line on the page is byte-identical to kit.ts's INSTALL_LINE`);
        await page.getByRole("button", { name: "Copy the install line" }).click();
        const clip = await page.evaluate(() => navigator.clipboard.readText());
        check(Buffer.from(clip, "utf8").equals(Buffer.from(den.pre, "utf8")), `${tag}: copy button puts the exact install line on the clipboard`);
        check(kit.steps === 4 && kit.cards.length === den.cards.length && kit.cards.every((ps, i) => ps.length === 2 && ps[0] === den.cards[i].code && ps[1] === den.cards[i].text), `${tag}: 4 steps; the ${den.count} kit cards (doctor, chat, persona, notebook, timer, save) match kit.ts word for word`);
        check(kit.guide == null, `${tag}: no "Install guide" link (install.html is gone)`);
        check(info.text.includes("It checks the file's fingerprint before installing anything. No sudo.") && !info.text.includes("the download may not work"), `${tag}: fingerprint/no-sudo note shown, no napping-download note`);
        await page.waitForTimeout(2600);
      }
      if (pg.name === "next") {
        const items = await page.locator("main ul li").allInnerTexts();
        check(COMING_NEXT.every((r) => items.some((t) => t.includes(r))), `${tag}: recipes shown`);
        check((await page.getByRole("link", { name: "Ask Fig on X" }).getAttribute("href")) === "https://x.com/AskFigFox", `${tag}: "Ask Fig on X" links to Fig on X`);
      }
      if (pg.name === "receipts") {
        // Exact cells (Codex review 10-22): version text, the main badge on exactly the main row, the full hash.
        const rows = await page.evaluate(() => [...document.querySelectorAll("main tbody tr")].map((tr) => {
          const th = tr.querySelector("th");
          const badges = [...(th?.querySelectorAll("span") ?? [])].map((x) => x.textContent ?? "");
          return { cells: tr.children.length, version: (th?.firstChild?.textContent ?? "").trim(), badges, hash: tr.querySelector("td")?.textContent ?? "" };
        }));
        check(rows.length === VERSIONS.length && VERSIONS.every((v, i) => rows[i].cells === 2 && rows[i].version === v.version && JSON.stringify(rows[i].badges) === JSON.stringify(v.main ? ["main"] : []) && rows[i].hash === v.sha256), `${tag}: all ${VERSIONS.length} versions, exact names, main badge only on ${VERSIONS.find((v) => v.main)?.version}, full hashes, in kit.ts's order`);
        check(/My own measurements|Fig's own measurements/.test(info.text) && info.text.includes("not independently checked: doctor 0.2 s · notebook ready 31 s · first chat reply 10.5 s."), `${tag}: the measured-timings caveat is kept`);
      }

      if (shots) {
        mkdirSync(shots, { recursive: true });
        await page.screenshot({ path: `${shots}/${pg.name}-${w}.png`, fullPage: true });
        console.log(`      saved ${shots}/${pg.name}-${w}.png`);
      }
      await page.close();
    }

    // Client-side navigation under the base path: window.__soft survives only a soft (RSC) navigation.
    const page = await ctx.newPage();
    const log = watch(page, origin);
    await page.goto(prefixed("/"), { waitUntil: "networkidle" });
    for (const [label, path, h1] of [["Use the kit", "/kit/", "Use the kit"], ["Receipts", "/receipts/", "Receipts"], ["What's next", "/next/", "What's next"], ["Home", "/", PAGES[0].h1]]) {
      await page.evaluate(() => (window.__soft = 1));
      await page.locator('nav[aria-label="Pages"]').getByRole("link", { name: label, exact: true }).click();
      await page.waitForURL(prefixed(path));
      const arrived = await page
        .waitForFunction((t) => document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim() === t, h1, { timeout: 10_000 })
        .then(() => true, () => false);
      const shown = norm(await page.locator("h1").first().textContent());
      const soft = await page.evaluate(() => window.__soft === 1);
      check(arrived && soft && new URL(page.url()).pathname === `${PREFIX}${path}`, `${w}px nav: "${label}" opens ${PREFIX}${path} client-side and shows "${shown}"`);
    }
    await page.evaluate(() => (window.__soft = 1));
    await page.locator("section[aria-labelledby=hero-title]").getByRole("link", { name: "Use the kit" }).click();
    await page.waitForURL(prefixed("/kit/"));
    const kitShown = await page
      .waitForFunction(() => document.querySelector("h1")?.textContent?.trim() === "Use the kit", null, { timeout: 10_000 })
      .then(() => true, () => false);
    check(kitShown && (await page.evaluate(() => window.__soft === 1)), `${w}px nav: hero "Use the kit" opens the kit page client-side and shows it`);
    const missed = await takeMisses();
    check(log.bad.length === 0 && log.errors.length === 0 && missed.length === 0, `${w}px nav: no bad responses, misses or console errors while navigating${[...log.bad, ...log.errors, ...missed.map((m) => m.path)].length ? `: ${[...log.bad, ...log.errors, ...missed.map((m) => m.path)].join(" | ")}` : ""}`);
    await page.close();
    await ctx.close();
  }

  const badLinks = [...linkSeen].filter(([, ok]) => !ok).map(([u]) => u);
  check(badLinks.length === 0, `all ${linkSeen.size} distinct links resolve (internal: 200 under ${PREFIX}/; external: on the allowlist)${badLinks.length ? `: ${badLinks.join(", ")}` : ""}`);
}

async function extraChecks(browser, { origin, misses, deployed }) {
  console.log("\n== EXTRAS (alias, today's fallback) ==");
  const take = async () => (await (await fetch(misses)).json()).map((m) => m.path);
  await take();
  const ctx = await newContext(browser, 390, origin);

  // Web4 also serves the app at /app/<token id>/. Assets use absolute /app/FIG/ paths, so they still load.
  let page = await ctx.newPage();
  let log = watch(page, origin);
  await page.goto(`${origin}${ALIAS}/`, { waitUntil: "networkidle" });
  let h1 = await page.locator("h1").textContent();
  let missed = await take();
  check(norm(h1) === PAGES[0].h1 && log.bad.length === 0 && log.errors.length === 0 && missed.length === 0, `alias ${ALIAS}/ renders Home with every asset loading${[...log.bad, ...log.errors, ...missed].length ? `: ${[...log.bad, ...log.errors, ...missed].join(" | ")}` : ""}`);
  await page.close();

  await ctx.close();

  // web-4.app answers unknown paths with 200 + index.html today. Our links always end in "/", so this only
  // matters for a hand-typed URL. Record what happens; it must not break the page.
  const s = await startServers({ root: deployed, port: 3451, figPort: 3452, fallback: true });
  const fctx = await newContext(browser, 390, s.base);
  page = await fctx.newPage();
  log = watch(page, s.base);
  await page.goto(`${s.base}${PREFIX}/kit`, { waitUntil: "networkidle" });
  h1 = norm(await page.locator("h1").textContent());
  const bad = log.bad.filter((b) => !b.endsWith(`${PREFIX}/kit came back as text/html; charset=utf-8`));
  check(log.errors.length === 0 && bad.length === 0 && h1.length > 0, `fallback (like today's web-4.app): ${PREFIX}/kit without the slash shows "${h1}" with no console errors (our links always add the slash)`);
  await page.close();
  await fctx.close();
  await s.close();
}

// ---------- run ----------
const browser = await launch();
try {
  const den = await denParity();
  if (LIVE) {
    const u = new URL(LIVE);
    await browserSuite(browser, { origin: u.origin, misses: null, den, shots: null, stubs: false });
  } else {
    packageChecks();
    const deployed = await deployChecks();
    if (process.argv.includes("--deploy-only")) throw Object.assign(new Error("stop"), { deployOnly: true });
    const s = await startServers({ root: deployed, port: 3441, figPort: 3442 });
    try {
      await browserSuite(browser, { origin: s.base, misses: `${s.base}/__test/misses`, den, shots: SHOTS, stubs: true });
      await extraChecks(browser, { origin: s.base, misses: `${s.base}/__test/misses`, deployed });
    } finally {
      await s.close();
    }
  }
} catch (e) {
  if (!e.deployOnly) throw e;
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures.length ? 1 : 0);
