import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Static export: `next build` writes plain HTML/CSS/JS. There is no server code,
// so every live number on the page is fetched by the visitor's browser from public APIs.
//
// Two targets, picked by FIG_LIVE_TARGET at build time:
// - default (unset): the local preview and the Vercel copy. Served from the site root, exported to out/.
// - "web4": Fig's own app page, https://web-4.app/app/FIG/. Fig's GPU computer serves /workspace/public
//   with a plain static file server and Web4 proxies it under /app/FIG/, so every asset and link must
//   carry that prefix. Exported to out-web4/ (so it never clobbers out/), then packed by scripts/pack-web4.mjs.
const TARGET = process.env.FIG_LIVE_TARGET ?? "default";
if (TARGET !== "default" && TARGET !== "web4") {
  throw new Error(`FIG_LIVE_TARGET must be unset or "web4" (got "${TARGET}")`);
}
const WEB4 = TARGET === "web4";
const WEB4_BASE_PATH = "/app/FIG";
const basePath = WEB4 ? WEB4_BASE_PATH : "";

// A random build id would make every web4 tarball different. Derive it from the inputs instead, so the
// same source always packs to the same bytes, whatever the commit (FIG_LIVE_BUILD_ID overrides).
// public/uptime.json is left out: it's a local snapshot the web4 build doesn't use.
function web4BuildId(): string {
  if (process.env.FIG_LIVE_BUILD_ID) return process.env.FIG_LIVE_BUILD_ID;
  const files = ["next.config.ts", "package.json", "package-lock.json", "postcss.config.mjs", "tsconfig.json"];
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => !e.name.startsWith(".")) // .DS_Store and friends are not inputs
      .flatMap((e) => (e.isDirectory() ? walk(join(dir, e.name)) : [join(dir, e.name)]));
  files.push(...walk("src"), ...walk("public").filter((f) => f !== join("public", "uptime.json")));
  const hash = createHash("sha256");
  for (const f of files.sort()) hash.update(`${f}\0`).update(readFileSync(f)).update("\0");
  return `web4-${hash.digest("hex").slice(0, 12)}`;
}

const nextConfig: NextConfig = {
  output: "export",
  // Each page exports as <path>/index.html, which `serve`, Vercel and any static host resolve.
  trailingSlash: true,
  poweredByHeader: false,
  devIndicators: false,
  images: { unoptimized: true },
  // Inlined at build time so components can prefix plain <img src> paths and pick target-only copy.
  env: { FIG_BASE_PATH: basePath, FIG_LIVE_TARGET: TARGET },
  ...(WEB4
    ? {
        basePath,
        assetPrefix: basePath,
        distDir: "out-web4",
        generateBuildId: async () => web4BuildId(),
      }
    : {}),
};

export default nextConfig;
