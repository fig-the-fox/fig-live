// Local stand-in for how Fig Live will run on Web4, for testing only. Two servers on 127.0.0.1:
//
// 1. "Fig's server" (the :8080 stand-in): a plain static file server over one directory, the way Fig's
//    GPU computer serves /workspace/public. "/" and "dir/" serve index.html. Unknown paths are 404.
// 2. "Web4" (the web-4.app stand-in): mounts that directory under /app/FIG/ (and the /app/<token id>/
//    alias Web4 also serves), and copies what Web4 was seen doing on 2026-10-21:
//    - adds its response headers (nosniff, frame-ancestors 'self', ACAO *, no-cache);
//    - injects two deferred analytics scripts plus og:image/twitter:image tags before </head> of every
//      HTML page (here they're small labelled STUBS, not Web4's code; they hook history.pushState and
//      send a same-origin beacon, as the real ones do);
//    - with --fallback, answers unknown paths with 200 + index.html, as web-4.app/app/FIG/ does today.
//      Without it, unknown paths are 404 so a missing asset fails loudly.
//    It proxies to server 1, so status and content-type come from "Fig's server", as in production.
//    Every request that matched no file is recorded; GET /__test/misses returns them (and clears them).
//
// Usage: node scripts/serve-web4.mjs [--root DIR | --tgz dist-web4/fig-live-web4.tgz] [--port 3431] [--fig-port 3432] [--fallback]
// With --tgz (the default), the tarball is checked against SHA256SUMS, then extracted with the system
// tar into a fresh temp dir beside fake copies of Fig's own files (install.html, feedback.html,
// fig-v0.2.2.sh, fig.sh, kit-files/), so links to them resolve the way they will on Fig's computer.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { extname, join, normalize, sep } from "node:path";

export const PREFIX = "/app/FIG";
export const TOKEN_ID = "35e13b19-858d-480c-8779-ad25bc6f4d45";
export const ALIAS = `/app/${TOKEN_ID}`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".sh": "text/plain; charset=utf-8", // what web-4.app sends for fig-v0.2.2.sh
};

// Same shape as Web4's injected tags (seen 2026-10-21), pointing at local stubs.
export const INJECTED =
  '<script defer src="/~flock.js" data-proxy-url="/~api/analytics"></script>' +
  '<script defer src="/__l5e/events.test-stub.js" data-artifact-kind="dwl_content_hash" data-artifact-id="test" data-context-token="test"></script>' +
  '<meta property="og:image" content="https://web4-injected.invalid/og.png"><meta name="twitter:image" content="https://web4-injected.invalid/og.png">';

const STUB_JS = (name, beacon) =>
  `// TEST STUB standing in for Web4's injected ${name}. Not Web4's code.\n` +
  `(function(){window.__web4Stubs=(window.__web4Stubs||[]).concat(${JSON.stringify(name)});var p=history.pushState;` +
  `history.pushState=function(){var r=p.apply(this,arguments);try{navigator.sendBeacon(${JSON.stringify(beacon)},"{}")}catch(e){}return r};})();\n`;

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export const FAKE_FIG_FILES = {
  "install.html":
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>FAKE install guide (local test)</title></head>' +
    '<body><p>FAKE stand-in for Fig\'s install.html, local test only.</p><a href="index.html">&larr; Back to Main Guide</a></body></html>\n',
  "feedback.html":
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>FAKE feedback page (local test)</title></head>' +
    '<body><p>FAKE stand-in for Fig\'s feedback.html, local test only.</p></body></html>\n',
  "fig-v0.2.2.sh": "#!/bin/sh\n# FAKE stand-in for Fig's kit release, local test only.\necho fake\n",
  "kit-files/fig-v0.2.2.sh": "#!/bin/sh\n# FAKE stand-in, local test only.\necho fake\n",
};

// Fig's own files, as they sit in /workspace/public next to the site (fig.sh is a symlink there too).
export function writeFakeFigFiles(dir) {
  for (const [rel, body] of Object.entries(FAKE_FIG_FILES)) {
    mkdirSync(join(dir, rel, ".."), { recursive: true });
    writeFileSync(join(dir, rel), body);
  }
  if (!existsSync(join(dir, "fig.sh"))) symlinkSync("fig-v0.2.2.sh", join(dir, "fig.sh"));
}

// Check the tarball against SHA256SUMS (as Fig's command does), then extract it with the system tar.
export function extractTarball(tgz, into) {
  const sums = readFileSync(join(tgz, "..", "SHA256SUMS"), "utf8");
  const want = sums.split("\n").find((l) => l.endsWith("  fig-live-web4.tgz"))?.slice(0, 64);
  const got = sha256(readFileSync(tgz));
  if (want !== got) throw new Error(`serve-web4: ${tgz} sha256 ${got} doesn't match SHA256SUMS (${want})`);
  mkdirSync(into, { recursive: true });
  execFileSync("tar", ["-xzf", tgz, "-C", into]);
  return got;
}

function resolveFile(root, urlPath) {
  let p;
  try {
    p = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const full = normalize(join(root, p));
  if (full !== root && !full.startsWith(root + sep)) return null; // no escaping the root
  try {
    const st = statSync(full);
    if (st.isDirectory()) {
      if (!p.endsWith("/")) return null; // like a plain static server, kit without a slash isn't kit/
      const idx = join(full, "index.html");
      return statSync(idx).isFile() ? idx : null;
    }
    return st.isFile() ? full : null;
  } catch {
    return null;
  }
}

const send = (res, status, headers, body) => {
  res.writeHead(status, headers);
  res.end(body);
};

// figMime lets a test make Fig's server send wrong content-types (to prove the Fig command rolls back).
// onFigRequest(path) runs before Fig's server answers (tests use it to break things mid-command).
// figTypeFor(path) may return a content-type that overrides figMime for one path (or null).
export function startServers({ root, port = 3431, figPort = 3432, fallback = false, figMime = MIME, onFigRequest = null, figTypeFor = null } = {}) {
  root = normalize(root);
  const misses = [];
  const figBase = `http://127.0.0.1:${figPort}`;

  // 1. Fig's server: plain static files over root.
  const fig = createServer((req, res) => {
    const path = new URL(req.url, "http://x").pathname;
    onFigRequest?.(path);
    const file = resolveFile(root, path);
    if (!file) return send(res, 404, { "content-type": "text/plain" }, "not found\n");
    const type = figTypeFor?.(path) ?? figMime[extname(file).toLowerCase()] ?? "application/octet-stream";
    send(res, 200, { "content-type": type }, req.method === "HEAD" ? undefined : readFileSync(file));
  });

  // 2. Web4: proxies /app/FIG/... (and the token-id alias) to Fig's server, the way web-4.app does,
  //    so status and content-type come from Fig's server. Then adds Web4's own headers and tags.
  const web4Headers = {
    "x-content-type-options": "nosniff",
    "content-security-policy": "frame-ancestors 'self'",
    "access-control-allow-origin": "*",
    "cache-control": "no-cache",
    "referrer-policy": "strict-origin-when-cross-origin",
  };
  const web4 = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    if (path === "/__test/misses") return send(res, 200, { "content-type": "application/json" }, JSON.stringify(misses.splice(0)));
    if (path === "/~flock.js") return send(res, 200, { ...web4Headers, "content-type": "text/javascript; charset=utf-8" }, STUB_JS("flock.js", "/~api/analytics/api/tracking"));
    if (path === "/__l5e/events.test-stub.js") return send(res, 200, { ...web4Headers, "content-type": "application/javascript; charset=utf-8" }, STUB_JS("l5e events", "/__l5e/trackevents"));
    if (req.method === "POST" && (path.startsWith("/~api/analytics/") || path === "/__l5e/trackevents")) return send(res, 204, web4Headers);

    const mount = [PREFIX, ALIAS].find((m) => path === m || path.startsWith(`${m}/`));
    if (!mount) {
      misses.push({ path, why: "outside /app/FIG/" });
      return send(res, 404, { ...web4Headers, "content-type": "text/plain" }, "not found (outside the app mount)\n");
    }
    if (path === mount) return send(res, 308, { ...web4Headers, location: `${mount}/` });
    try {
      let up = await fetch(figBase + path.slice(mount.length) + url.search, { redirect: "manual" });
      if (up.status === 404) {
        misses.push({ path, why: "Fig's server: 404" });
        if (fallback) up = await fetch(`${figBase}/`); // what web-4.app/app/FIG/ does for unknown paths today
      }
      const type = up.headers.get("content-type") ?? "application/octet-stream";
      let body = Buffer.from(await up.arrayBuffer());
      if (type.startsWith("text/html")) body = Buffer.from(body.toString("utf8").replace("</head>", `${INJECTED}</head>`), "utf8");
      send(res, up.status, { ...web4Headers, "content-type": type }, req.method === "HEAD" ? undefined : body);
    } catch (e) {
      misses.push({ path, why: `proxy error: ${e}` });
      send(res, 502, { ...web4Headers, "content-type": "text/plain" }, "bad gateway\n");
    }
  });

  return Promise.all([
    new Promise((ok) => fig.listen(figPort, "127.0.0.1", ok)),
    new Promise((ok) => web4.listen(port, "127.0.0.1", ok)),
  ]).then(() => ({
    base: `http://127.0.0.1:${port}`,
    figBase,
    close: () => Promise.all([new Promise((ok) => fig.close(ok)), new Promise((ok) => web4.close(ok))]),
  }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name, dflt) => {
    const i = process.argv.indexOf(name);
    return i > 0 ? process.argv[i + 1] : dflt;
  };
  let root = arg("--root", null);
  if (!root) {
    const tgz = arg("--tgz", "dist-web4/fig-live-web4.tgz");
    root = mkdtempSync(join(tmpdir(), "fig-live-web4-"));
    writeFakeFigFiles(root);
    const sha = extractTarball(tgz, root);
    console.log(`extracted ${tgz} (sha256 ${sha}) into ${root}, beside fake install.html, fig-v0.2.2.sh, fig.sh and kit-files/`);
  }
  const s = await startServers({
    root,
    port: Number(arg("--port", 3431)),
    figPort: Number(arg("--fig-port", 3432)),
    fallback: process.argv.includes("--fallback"),
  });
  console.log(`Web4 stand-in: ${s.base}${PREFIX}/   (Fig's server stand-in: ${s.figBase}/)`);
}
