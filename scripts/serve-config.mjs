// Makes the local preview send the same headers Vercel will, so the browser checks exercise the
// production header set (CSP with frame-ancestors, Permissions-Policy, ...) and not just the meta tag.
// vercel.json is the source of truth; `serve` uses glob paths, so the one "/(.*)" rule becomes "**".
import { readFile, writeFile } from "node:fs/promises";

const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
if (vercel.headers?.length !== 1 || vercel.headers[0].source !== "/(.*)") {
  throw new Error("vercel.json should have exactly one catch-all header rule; update scripts/serve-config.mjs if that changes");
}
const config = {
  trailingSlash: Boolean(vercel.trailingSlash),
  headers: [{ source: "**", headers: vercel.headers[0].headers }],
};
await writeFile("serve.local.json", JSON.stringify(config, null, 2) + "\n");
console.log("wrote serve.local.json from vercel.json");
