// Renders the 1200x630 share card (Open Graph + X/Twitter) from Fig's face in public/.
// Usage: node scripts/build-og.mjs   (needs network once for the Google Fonts CSS)
// Writes src/app/opengraph-image.png and src/app/twitter-image.png; Next turns those files into
// og:image / twitter:image tags with absolute URLs built from metadataBase (SITE_URL).
// The card never shows prices or market numbers.

import { chromium } from "playwright-core";
import { readFile, copyFile } from "node:fs/promises";

const face = (await readFile("public/fig.webp")).toString("base64");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600&family=Fraunces:ital,opsz,wght,SOFT@0,9..144,500,100;1,9..144,500,100&display=block" rel="stylesheet">
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1200px;height:630px;background:#2b1430;color:#f5eee6;overflow:hidden}
  .card{position:relative;width:1200px;height:630px;display:flex;align-items:center;gap:64px;padding:0 84px}
  .card::before{content:"";position:absolute;inset:28px;border:1px solid #5c2c55}
  .ear{position:absolute;top:28px;right:28px;width:30px;height:30px;background:#ffa24a;clip-path:polygon(0 0,100% 0,100% 100%)}
  .text{flex:1;position:relative}
  .eyebrow{font:600 24px/1 Figtree,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:#d6c4d2;display:flex;align-items:center;gap:16px}
  .eyebrow i{display:block;width:40px;height:2px;background:#ffa24a}
  h1{margin-top:28px;font:500 128px/0.95 Fraunces,serif;font-variation-settings:"SOFT" 100,"WONK" 0;letter-spacing:-.02em}
  h1 em{font-style:italic;color:#ffa24a;font-variation-settings:"SOFT" 100,"WONK" 1}
  p{margin-top:30px;font:500 42px/1.25 Figtree,sans-serif;color:#f5eee6;max-width:13em;text-wrap:balance}
  .face{position:relative;width:380px;height:380px;flex:none;clip-path:polygon(0 0,calc(100% - 36px) 0,100% 36px,100% 100%,36px 100%,0 calc(100% - 36px))}
  .face img{width:100%;height:100%;display:block}
</style></head><body>
<div class="card"><div class="ear"></div>
  <div class="text">
    <div class="eyebrow"><i></i>Live from the den</div>
    <h1>Fig <em>Live</em></h1>
    <p>A fox with its own GPU on Web4</p>
  </div>
  <div class="face"><img src="data:image/webp;base64,${face}" alt=""></div>
</div></body></html>`;

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.setContent(html, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family));
  if (!fonts.some((f) => f.includes("Fraunces")) || !fonts.some((f) => f.includes("Figtree"))) {
    throw new Error(`fonts didn't load (${fonts.join(", ") || "none"}); refusing to write a card in fallback fonts`);
  }
  await page.screenshot({ path: "src/app/opengraph-image.png", type: "png" });
  await copyFile("src/app/opengraph-image.png", "src/app/twitter-image.png");
  console.log("wrote src/app/opengraph-image.png and src/app/twitter-image.png (1200x630)");
} finally {
  await browser.close();
}
