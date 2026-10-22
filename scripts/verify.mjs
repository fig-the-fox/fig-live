// End-to-end check of the built site in a real (headless) Chrome, on every page at 390 and 1280 px.
// Usage: npm run build && npm run preview (in another shell) && node scripts/verify.mjs [baseUrl]
//
// 1. LIVE: no mocks. Home must fetch Web4 + DexScreener cross-origin and render real data; the
//    other three pages must be static (no API calls). Every page: nav, no console errors, no
//    sideways scroll, no step-command text. Screenshots: docs/screens/<page>-<width>.png
// 2. FIXTURE (Home, all four Web4 states + one unknown): Web4's computer + steps + screen are replaced
//    by the dev-only fixture in scripts/fixtures/web4.mjs via request interception. Every fixture
//    screenshot carries a TEST FIXTURE label.
// 3. OFFLINE (Home): Web4 blocked from the start, and after a good load.
// 0. HEADERS (first): vercel.json's CSP must equal the page's meta CSP plus frame-ancestors, the preview
//    (`npm run preview` mirrors vercel.json) must send those headers, and the site must refuse framing.

import { chromium } from "playwright-core";
import { mkdir, readFile } from "node:fs/promises";
import { FIXTURE_COMMAND_SENTINEL, FIXTURE_XSS_THOUGHT, FRAME_HTML, fixtureComputer, fixtureScreenUrl, fixtureSteps } from "./fixtures/web4.mjs";
import { INSTALL_LINE, VERSIONS, COMING_NEXT, CLAIM_TITLE, CLAIM_LEAD, RENT_URL, ASK_FIG_LABEL } from "../src/content/kit.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3421").replace(/\/$/, "");
const TOKEN_ID = "35e13b19-858d-480c-8779-ad25bc6f4d45";
const MINT = "CJ3M8Vj8xB65XvcUXvfMf8XmjxazMtUpgKZQtCiAweb4";
const PROJECT_URL = `https://web-4.app/project/${TOKEN_ID}`;
const SHOTS = "docs/screens";
const WIDTHS = [390, 1280];
const PAGES = [
  { name: "home", path: "/", h1: `${CLAIM_TITLE.lead} ${CLAIM_TITLE.rest}` },
  { name: "kit", path: "/kit/", h1: "Use the kit" },
  { name: "next", path: "/next/", h1: "What's next" },
  { name: "receipts", path: "/receipts/", h1: "Receipts" },
];

const failures = [];
const check = (ok, msg) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${msg}`);
  if (!ok) failures.push(msg);
};

async function launch() {
  try {
    return await chromium.launch({ channel: "chrome", headless: true });
  } catch {
    return await chromium.launch({ headless: true }); // Playwright's own Chromium, if installed
  }
}

async function newContext(browser, width) {
  const ctx = await browser.newContext({
    viewport: { width, height: width < 500 ? 844 : 900 },
    deviceScaleFactor: width < 500 ? 2 : 1,
    isMobile: width < 500,
    hasTouch: width < 500,
    colorScheme: "dark",
  });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"], { origin: BASE });
  return ctx;
}

// Fig's screen: the computer's screen_url (no /v1/), with this as the page's fallback. The /v1/ frame
// path answered 404 while Fig was running on 2026-10-21, so the page must never use it.
const SCREEN_URL = `https://web-4.app/api/public/machine/frame?id=35e13b19-858d-480c-8779-ad25bc6f4d45`;
const SCREEN_ROUTE = /https:\/\/web-4\.app\/api\/public\/machine\/frame\?id=.*/;
const isV1Frame = (u) => u.startsWith("https://web-4.app/api/public/v1/machine/frame");
const isApi = (u) => u.startsWith("https://web-4.app/api/") || u.startsWith("https://api.dexscreener.com/");

function watch(page) {
  const log = { responses: [], apiRequests: [], failed: [], errors: [] };
  page.on("request", (r) => isApi(r.url()) && log.apiRequests.push(r.url()));
  page.on("request", (r) => isV1Frame(r.url()) && (log.v1Frames = (log.v1Frames ?? 0) + 1));
  page.on("response", (r) => {
    if (isApi(r.url())) log.responses.push({ url: r.url(), status: r.status(), acao: r.headers()["access-control-allow-origin"] ?? null });
  });
  page.on("requestfailed", (r) => log.failed.push({ url: r.url(), why: r.failure()?.errorText }));
  page.on("console", (m) => m.type() === "error" && log.errors.push(m.text()));
  page.on("pageerror", (e) => log.errors.push(String(e)));
  return log;
}

const settled = (page, timeout = 20_000) => page.waitForSelector('#status[data-settled="yes"]', { timeout });
const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const norm = (p) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

async function banner(page, text) {
  await page.evaluate((t) => {
    const b = document.createElement("div");
    b.textContent = t;
    Object.assign(b.style, {
      position: "absolute", top: "0", left: "0", right: "0", zIndex: "9999", padding: "6px 12px",
      background: "#ffe14a", color: "#000", font: "bold 13px/1.4 system-ui, sans-serif", textAlign: "center",
    });
    document.body.prepend(b);
  }, text);
}

async function checkCopy(page, w) {
  await page.getByRole("button", { name: "Copy the install line" }).click();
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  check(clip === INSTALL_LINE && clip.includes(`${VERSIONS.find((v) => v.main).sha256}  /tmp/fig.sh" | sha256sum -c`), `${w}px kit: copy button puts the exact install line on the clipboard (two-space sha256 format intact)`);
  check((await page.getByRole("button", { name: "Copied" }).count()) === 1, `${w}px kit: copy button confirms with "Copied"`);
  await page.waitForTimeout(2600); // let the label reset before the screenshot
}

const browser = await launch();
await mkdir(SHOTS, { recursive: true });

// The real step commands, so we can prove none of them reach any page.
const realSteps = await fetch(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}/steps`).then((r) => r.json());
const commandSnippets = (realSteps.data ?? [])
  .map((s) => (typeof s.command === "string" ? s.command.replace(/\s+/g, " ").trim().slice(0, 40) : ""))
  .filter((s) => s.length >= 12);
console.log(`(${commandSnippets.length} real step commands loaded for the leak check)`);

try {
  // ---------- 0. HEADERS ----------
  console.log("\n== HEADERS (vercel.json vs page vs preview) ==");
  {
    const vercel = JSON.parse(await readFile("vercel.json", "utf8"));
    const want = Object.fromEntries(vercel.headers[0].headers.map((h) => [h.key.toLowerCase(), h.value]));
    const html = await readFile("out/index.html", "utf8");
    const meta = (html.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/) ?? [])[1]?.replaceAll("&#x27;", "'");
    check(!!meta && want["content-security-policy"] === `${meta}; frame-ancestors 'none'`, "vercel.json CSP = page meta CSP + frame-ancestors 'none'");
    const res = await fetch(BASE + "/");
    const sent = Object.keys(want).filter((k) => res.headers.get(k) !== want[k]);
    check(sent.length === 0, `preview sends the vercel.json headers${sent.length ? ` (mismatch: ${sent.join(", ")})` : ""}`);
    const redirect = await fetch(BASE + "/kit", { redirect: "manual" });
    check([301, 308].includes(redirect.status) && redirect.headers.get("location") === "/kit/", `/kit redirects to /kit/ (${redirect.status})`);
    check(!html.includes("/app/FIG/_next") && /src="\/_next\/static\//.test(html), "default build has no /app/FIG base path (that's the web4 build only)");
    const uptimeText = await (await fetch(BASE + "/uptime.json")).text();
    const uptime = JSON.parse(uptimeText);
    const leaks = ["/Users/", "atlas", TOKEN_ID, MINT, "web-4.app", "log.jsonl"].filter((f) => uptimeText.includes(f));
    check(uptime.buckets?.length === 144 && Number.isFinite(Date.parse(uptime.generated_at)) && leaks.length === 0, `uptime.json: 144 ten-minute blocks, generated_at ${uptime.generated_at}, no local paths or ids${leaks.length ? ` (found: ${leaks.join(", ")})` : ""}`);
    const page = await browser.newPage();
    await page.setContent(`<iframe src="${BASE}/" width="400" height="300"></iframe>`);
    await page.waitForTimeout(1500);
    const inner = page.frames()[1];
    const framed = inner ? await inner.evaluate(() => document.body?.innerText ?? "").catch(() => "") : "";
    check(!framed.includes("figure it out"), "site refuses to render inside another page's iframe");
    await page.close();
  }

  // ---------- 1. LIVE, every page ----------
  for (const w of WIDTHS) {
    console.log(`\n== LIVE @ ${w}px (real Web4 + DexScreener, no mocks) ==`);
    const ctx = await newContext(browser, w);
    for (const pg of PAGES) {
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(BASE + pg.path, { waitUntil: "domcontentloaded" });
      if (pg.name === "home") {
        await settled(page);
        await page.waitForFunction(() => document.querySelectorAll("#now ol li").length > 0, null, { timeout: 15_000 }).catch(() => {});
      }
      await page.waitForLoadState("networkidle").catch(() => {});
      if (pg.name !== "home") await page.waitForTimeout(1500); // give any stray poller time to show itself

      const common = await page.evaluate(() => ({
        h1: document.querySelector("h1")?.textContent?.replace(/\s+/g, " ").trim(),
        navLinks: [...document.querySelectorAll('nav[aria-label="Pages"] a')].map((a) => ({ href: a.getAttribute("href"), label: a.textContent, current: a.getAttribute("aria-current") })),
        text: document.body.innerText,
        title: document.title,
      }));
      const tag = `${w}px ${pg.name}`;
      const current = common.navLinks.filter((l) => l.current === "page");
      check(common.navLinks.length === 4 && current.length === 1 && norm(current[0].href) === norm(pg.path), `${tag}: nav has 4 links, "${current[0]?.label}" marked current`);
      check(common.h1 === pg.h1, `${tag}: h1 "${common.h1}" · title "${common.title}"`);
      const leaked = commandSnippets.filter((c) => common.text.includes(c));
      check(commandSnippets.length > 0 && leaked.length === 0, `${tag}: none of the real step commands appear`);
      check(log.errors.length === 0, `${tag}: no console errors / CSP violations${log.errors.length ? `: ${log.errors.join(" | ")}` : ""}`);
      check(log.failed.length === 0, `${tag}: no failed requests${log.failed.length ? `: ${JSON.stringify(log.failed)}` : ""}`);
      if (pg.name === "home" || pg.name === "kit") {
        const fb = await page.locator("a[data-feedback]").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        check(fb.length >= 1 && fb.every((h) => h === "https://x.com/AskFigFox"), `${tag}: Feedback section links Fig on X (${fb.length}×)`);
      }
      if (pg.name === "home" || pg.name === "kit") {
        const chat = await page.evaluate((label) => [...document.querySelectorAll("a")].filter((a) => a.textContent?.trim() === label).map((a) => a.getAttribute("href")), ASK_FIG_LABEL);
        check(chat.length >= 1 && chat.every((h) => h === "https://x.com/AskFigFox"), `${tag}: "${ASK_FIG_LABEL}" links to Fig on X (${chat.length}×)`);
      }
      check(!/holder chat/i.test(common.text) && (await page.locator('a[href*="web-4.app/app/FIG"]').count()) === 0, `${tag}: no holder chat, no dead web-4.app/app/FIG links`);
      const ox = await overflowX(page);
      check(ox <= 0, `${tag}: no horizontal scroll (${ox}px)`);
      const levels = await page.evaluate(() => [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => Number(h.tagName[1])));
      const skip = levels.findIndex((l, i) => i > 0 && l > levels[i - 1] + 1);
      check(levels[0] === 1 && skip === -1, `${tag}: heading levels start at h1 and never skip (${levels.join(",")})`);
      await page.keyboard.press("Tab"); // keyboard modality, so .focus() below counts as :focus-visible
      const clipped = await page.locator("a, button").evaluateAll((els) => els.map((el, i) => (getComputedStyle(el).clipPath !== "none" ? i : -1)).filter((i) => i >= 0));
      const badRings = [];
      for (const i of clipped) {
        const el = page.locator("a, button").nth(i);
        await el.focus();
        const ring = await el.evaluate((n) => {
          const cs = getComputedStyle(n);
          return { fv: n.matches(":focus-visible"), style: cs.outlineStyle, offset: parseFloat(cs.outlineOffset), width: parseFloat(cs.outlineWidth), text: n.textContent };
        });
        // The outline must sit inside the element (negative offset at least its width), or clip-path cuts it off.
        if (!ring.fv || ring.style === "none" || !(ring.offset <= -ring.width)) badRings.push(ring.text);
      }
      check(badRings.length === 0, `${tag}: keyboard focus ring visible on ${clipped.length} clipped control(s)${badRings.length ? ` (cut off: ${badRings.join(", ")})` : ""}`);

      if (pg.name === "home") {
        const info = await page.evaluate(() => {
          const s = document.querySelector("#status");
          return {
            mood: s?.getAttribute("data-mood"),
            label: s?.querySelector("[data-label]")?.textContent,
            small: [...(s?.querySelectorAll("p") ?? [])].map((p) => p.textContent).find((t) => t?.startsWith("Web4 status")),
            market: [...(s?.querySelectorAll("dd") ?? [])][2]?.textContent,
            launched: [...(s?.querySelectorAll("dd") ?? [])][1]?.textContent,
            thoughts: [...document.querySelectorAll("#now ol li p:last-child")].map((p) => p.textContent),
            frameImgs: [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame")).length,
            heroLinks: [...document.querySelectorAll("section[aria-labelledby=hero-title] a")].map((a) => [a.textContent, a.getAttribute("href")]),
          };
        });
        if (w === WIDTHS[0]) {
          for (const [name, match] of [
            ["tokens", (u) => u.endsWith(`/tokens/${TOKEN_ID}`)],
            ["computers", (u) => u.endsWith(`/computers/${TOKEN_ID}`)],
            ["steps", (u) => u.endsWith(`/computers/${TOKEN_ID}/steps`)],
            ["dexscreener", (u) => u.endsWith(`/tokens/${MINT}`)],
          ]) {
            const r = log.responses.find((x) => match(x.url));
            check(!!r && r.status === 200 && r.acao === "*", `cross-origin ${name}: ${r ? `HTTP ${r.status}, access-control-allow-origin=${r.acao}` : "no response seen"}`);
          }
          console.log(`      status=${info.mood} label="${info.label}" | ${info.small} | launched ${info.launched} | market ${info.market}`);
          console.log(`      newest thought: "${(info.thoughts[0] ?? "").slice(0, 90)}…"`);
        }
        check(info.mood && info.mood !== "unreachable", `${tag}: status rendered from live data (${info.mood})`);
        check(info.thoughts.length >= 3 && info.thoughts.length <= 5, `${tag}: ${info.thoughts.length} live thoughts shown (3–5)`);
        check(/\$[\d.]+[KMB]?/.test(info.market ?? ""), `${tag}: market cap rendered (${info.market})`);
        check(/steps taken since launch/.test(info.small ?? ""), `${tag}: steps_total rendered`);
        if (info.mood === "napping") check(common.text.includes("Fig is napping") && info.frameImgs === 0, `${tag}: napping card shown, no live-screen <img>`);
        if (info.mood === "awake" || info.mood === "idle") {
          await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => i.src.includes("machine/frame") && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => {});
          const shown = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame") && i.naturalWidth > 0).map((i) => i.src));
          // Compare with what the API says screen_url is right now; only the page's refresh parameter may be added.
          const api = await (await fetch(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}`)).json();
          const fromApi = (u) => {
            const x = new URL(u);
            x.searchParams.delete("t");
            return typeof api.screen_url === "string" && x.toString() === new URL(api.screen_url).toString();
          };
          check(shown.length > 0 && shown.every(fromApi) && !log.v1Frames, `${tag}: Fig is ${info.mood}, and its real screen loads from the API's screen_url (no /v1/ frame request)`);
        }
        const up = await page.evaluate(() => {
          const sec = document.querySelector("section[aria-labelledby=uptime-title]");
          return {
            asOf: sec?.querySelector("time")?.textContent ?? "",
            header: sec?.querySelector("h2")?.parentElement?.innerText ?? "",
            label: sec?.querySelector("[role=img]")?.getAttribute("aria-label") ?? "",
            segments: sec?.querySelectorAll("[role=img] > div").length ?? 0,
            note: sec?.innerText.includes("The status above is live") ?? false,
          };
        });
        check(up.segments > 0 && /\d/.test(up.asOf) && up.label.startsWith("Last 24 hours:") && up.note, `${tag}: uptime strip shows "history as of ${up.asOf}" (${up.segments} segments; ${up.label})`);
        check(/ago|just now/.test(up.header), `${tag}: uptime strip says how old the snapshot is (${up.header.replace(/\s+/g, " ")})`);
        // The hero leads with the free GPU hour (den, 2026-10-21): one call to action ("Use the kit"), plus the
        // web-4.app/rent link inside the how-to-claim steps. Still no "Is Fig awake?" (the status card is right below).
        check(
          info.heroLinks.length === 2 &&
            info.heroLinks.some(([t, h]) => t === "Use the kit" && h === "/kit/") &&
            info.heroLinks.some(([t, h]) => t === "web-4.app/rent" && h === RENT_URL) &&
            !common.text.includes("Is Fig awake?"),
          `${tag}: hero links are exactly "Use the kit" (→ /kit/) and web-4.app/rent, no "Is Fig awake?"`,
        );
        check(common.text.includes(CLAIM_LEAD) && /How to claim it/i.test(common.text), `${tag}: hero has the free-GPU-hour claim and how to claim it`);
      } else {
        check(log.apiRequests.length === 0, `${tag}: static page, no API calls${log.apiRequests.length ? `: ${log.apiRequests.join(", ")}` : ""}`);
      }

      if (pg.name === "kit") {
        const steps = await page.locator("main ol > li").count();
        check(steps === 4, `${tag}: 4 steps shown (${steps})`);
        check(!common.text.includes("the download may not work"), `${tag}: no napping-download note (the kit is hosted on GitHub now)`);
        check(common.text.includes("It checks the file's fingerprint before installing anything. No sudo."), `${tag}: fingerprint / no-sudo note shown`);
        check((await page.locator("a[data-install-guide]").count()) === 0, `${tag}: no "Install guide" link (install.html is gone)`);
        await checkCopy(page, w);
      }
      if (pg.name === "next") {
        const recipes = await page.locator("main ul li").allInnerTexts();
        check(COMING_NEXT.every((r) => recipes.some((t) => t.includes(r))), `${tag}: recipes shown (${COMING_NEXT.join(" · ")})`);
        const vote = page.getByRole("link", { name: "Ask Fig on X" });
        check((await vote.getAttribute("href")) === "https://x.com/AskFigFox", `${tag}: "Ask Fig on X" links to Fig on X`);
      }
      if (pg.name === "receipts") {
        const rows = await page.locator("main tbody tr").allInnerTexts();
        check(rows.length === VERSIONS.length && VERSIONS.every((v) => rows.some((t) => t.includes(v.version) && t.includes(v.sha256))), `${tag}: ${rows.length} versions with full fingerprints`);
        check(/v0\.2\.0\) failed and was pulled/.test(common.text) && common.text.includes("not independently checked"), `${tag}: review note and Fig's own measurements shown`);
      }

      const file = `${SHOTS}/${pg.name}-${w}.png`;
      await page.screenshot({ path: file, fullPage: true });
      console.log(`      saved ${file}`);
      await page.close();
    }

    // Navigation: nav link and hero button both reach the kit page client-side.
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.locator('nav[aria-label="Pages"]').getByRole("link", { name: "Receipts" }).click();
    await page.waitForURL(/\/receipts\/$/);
    check((await page.locator("h1").textContent()) === "Receipts", `${w}px nav: Home → Receipts link works`);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await page.locator("section[aria-labelledby=hero-title]").getByRole("link", { name: "Use the kit" }).click();
    await page.waitForURL(/\/kit\/$/);
    check((await page.locator("h1").textContent()) === "Use the kit", `${w}px nav: hero "Use the kit" button opens the kit page`);
    await ctx.close();
  }

  // ---------- 2. FIXTURE: Home in every Web4 state ----------
  console.log("\n== FIXTURE (Home, dev-only mocked Web4 states) ==");
  const framePage = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await framePage.setContent(FRAME_HTML);
  const frameJpg = await framePage.screenshot({ type: "jpeg", quality: 80 });
  await framePage.close();

  const STATES = [
    { status: "running", mood: "awake", label: "Awake", sentence: "Fig's computer is on and Fig is working.", screen: true },
    { status: "built", mood: "idle", label: "Awake (idle)", sentence: "Fig's computer is on, but Fig isn't working on anything this minute.", screen: true },
    { status: "sleeping", mood: "napping", label: "Napping", sentence: "Fig's computer is switched off right now", card: "Fig is napping" },
    { status: "not_started", mood: "between", label: "Between computers", sentence: "Fig's GPU is off right now. Web4's new Build lets Fig keep building without one.", card: "Fig is between computers" },
    { status: "starting", mood: "unknown", label: "Not sure", sentence: "Web4 reported a status this page doesn't recognise yet.", widths: [390] },
    // Awake, but Web4's newest frame is 10 minutes old: the picture shows, marked Paused with its age.
    { status: "running", name: "running-stale-frame", frameAgeS: 600, mood: "awake", label: "Awake", sentence: "Fig's computer is on and Fig is working.", screen: true, paused: /10 min ago/, widths: [390] },
    // A frame "from the future" (the visitor's clock is slow, or Web4's is fast): freshness can't be known, so not LIVE.
    { status: "running", name: "running-future-frame", frameAgeS: -900, mood: "awake", label: "Awake", sentence: "Fig's computer is on and Fig is working.", screen: true, paused: /clock looks off/, widths: [390] },
  ];

  for (const st of STATES) {
    for (const w of st.widths ?? WIDTHS) {
      const ctx = await newContext(browser, w);
      const page = await ctx.newPage();
      const log = watch(page);
      let dialogs = 0;
      page.on("dialog", (d) => {
        dialogs++;
        void d.dismiss();
      });
      const cors = { "access-control-allow-origin": "*" };
      await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}`, (r) => r.fulfill({ json: fixtureComputer(TOKEN_ID, st.status, { frameAgeS: st.frameAgeS }), headers: cors }));
      await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}/steps`, (r) => r.fulfill({ json: fixtureSteps(), headers: cors }));
      await page.route(SCREEN_ROUTE, (r) => r.fulfill({ status: 200, body: frameJpg, headers: { "content-type": "image/jpeg", "cache-control": "no-store" } }));
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
      await settled(page);
      if (st.screen) {
        await page
          .waitForFunction(() => {
            const img = [...document.querySelectorAll("img")].find((i) => i.src.includes("machine/frame"));
            return img && img.complete && img.naturalWidth > 0;
          }, null, { timeout: 15_000 })
          .catch(() => {});
      } else {
        await page.waitForTimeout(800);
      }

      const info = await page.evaluate(() => ({
        mood: document.querySelector("#status")?.getAttribute("data-mood"),
        label: document.querySelector("#status [data-label]")?.textContent,
        statusText: document.querySelector("#status")?.innerText ?? "",
        nowText: document.querySelector("#now")?.innerText ?? "",
        html: document.documentElement.outerHTML,
        text: document.body.innerText,
        frameImgs: [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame")).length,
        screenOk: [...document.querySelectorAll("img")].some((i) => i.src.includes("machine/frame") && i.naturalWidth > 0),
        frameSrcs: [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame")).map((i) => i.src),
        xss: window.__xss ?? null,
        injectedImgs: [...document.querySelectorAll("#now img")].filter((i) => i.getAttribute("src") === "x").length,
      }));
      const tag = `${w}px fixture ${st.name ?? st.status}`;
      check(info.mood === st.mood && info.label === st.label, `${tag}: reads "${info.label}" (${info.mood})`);
      check(info.statusText.includes(st.sentence), `${tag}: plain-words sentence shown`);
      check(info.statusText.includes(`Web4 status: \u201c${st.status}\u201d`), `${tag}: raw status in small print`);
      if (st.screen) {
        check(info.screenOk && info.frameSrcs.length > 0 && info.frameSrcs.every((u) => u.startsWith(fixtureScreenUrl(TOKEN_ID))), `${tag}: screen image comes from the computer's screen_url and loads`);
        check(!log.v1Frames, `${tag}: never asks the /v1/ frame path (it 404s while Fig runs)`);
        if (st.paused) {
          const caption = info.nowText.match(/(Fig's screen isn't updating|This page can't tell)[^\n]*/)?.[0] ?? "";
          check(!/\bLIVE\b/.test(info.nowText) && /Paused/i.test(info.nowText) && st.paused.test(caption), `${tag}: a frame that can't be shown fresh reads Paused, not LIVE, and says why ("${caption}")`);
        }
        else check(/\bLIVE\b/.test(info.nowText), `${tag}: fresh frame (seconds old) shows the LIVE tag`);
      }
      else if (st.card) check(info.frameImgs === 0 && info.nowText.includes(st.card), `${tag}: "${st.card}" card instead of a screen`);
      if (st.mood === "unknown") {
        const words = ["napping", "asleep", "dozed"].filter((w) => (info.statusText + " " + info.nowText).toLowerCase().includes(w));
        check(words.length === 0 && info.frameImgs === 0, `${tag}: unknown status isn't described as napping/asleep${words.length ? ` (found: ${words.join(", ")})` : ""}`);
      }
      check(!info.html.includes(FIXTURE_COMMAND_SENTINEL), `${tag}: step command field never reaches the DOM`);
      check(info.xss === null && dialogs === 0 && info.injectedImgs === 0 && info.text.includes(FIXTURE_XSS_THOUGHT.replace(/\s+/g, " ")), `${tag}: HTML in a thought shows as literal text and never runs`);
      check(log.errors.length === 0, `${tag}: no console errors${log.errors.length ? `: ${log.errors.join(" | ")}` : ""}`);
      const ox = await overflowX(page);
      check(ox <= 0, `${tag}: no horizontal scroll (${ox}px)`);

      if (st.status === "running" && !st.name) {
        await banner(page, "TEST FIXTURE: mocked awake state (Web4 computer, steps and screen are fake). Not real data.");
        const file = `${SHOTS}/fixture-awake-home-${w}.png`;
        await page.screenshot({ path: file, fullPage: true });
        console.log(`      saved ${file}`);
      }
      if (w === 390 && st.mood !== "unknown") {
        // Status card + what-Fig-is-doing for each state, labelled so it can't pass for real data.
        await page.evaluate(() => {
          for (const id of ["status", "now"]) {
            const tagEl = document.createElement("div");
            tagEl.textContent = "TEST FIXTURE";
            Object.assign(tagEl.style, { position: "absolute", top: "0", right: "0", zIndex: "50", padding: "2px 8px", background: "#ffe14a", color: "#000", font: "bold 11px/1.4 system-ui, sans-serif" });
            const el = document.getElementById(id);
            el.style.position = "relative";
            el.prepend(tagEl);
          }
        });
        const box = await page.evaluate(() => {
          const a = document.getElementById("status").getBoundingClientRect();
          const b = document.querySelector("#now .aspect-video, #now figure")?.getBoundingClientRect() ?? document.getElementById("now").getBoundingClientRect();
          return { y: a.top + window.scrollY, h: b.bottom + window.scrollY - (a.top + window.scrollY) };
        });
        const file = `${SHOTS}/fixture-state-${st.name ?? st.status}-390.png`;
        await page.screenshot({ path: file, fullPage: true, clip: { x: 0, y: Math.max(0, box.y - 8), width: 390, height: box.h + 16 } });
        console.log(`      saved ${file}`);
      }
      await ctx.close();
    }
  }

  // ---------- 2a. A screen_url that isn't Web4's is ignored ----------
  console.log("\n== FIXTURE (screen_url pointing off Web4) ==");
  {
    const ctx = await newContext(browser, 390);
    const page = await ctx.newPage();
    const log = watch(page);
    const cors = { "access-control-allow-origin": "*" };
    await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}`, (r) => r.fulfill({ json: fixtureComputer(TOKEN_ID, "running", { screenUrl: "https://example.com/frame.jpg" }), headers: cors }));
    await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}/steps`, (r) => r.fulfill({ json: fixtureSteps(), headers: cors }));
    await page.route(SCREEN_ROUTE, (r) => r.fulfill({ status: 200, body: frameJpg, headers: { "content-type": "image/jpeg", "cache-control": "no-store" } }));
    let offsite = 0;
    page.on("request", (r) => r.url().startsWith("https://example.com/") && offsite++);
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => i.src.includes("machine/frame") && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => {});
    const srcs = await page.evaluate(() => [...document.querySelectorAll("img")].filter((i) => i.src.includes("machine/frame") || i.src.includes("example.com")).map((i) => i.src));
    check(offsite === 0 && srcs.length > 0 && srcs.every((u) => u.startsWith(`${SCREEN_URL}&t=`)) && log.errors.length === 0, `off-site screen_url is ignored; the page uses Web4's own screen URL instead (${srcs[0]?.slice(0, 70) ?? "no image"}…)`);
    await ctx.close();
  }

  // ---------- 2b. STALE: awake fixture, then the feeds start failing ----------
  console.log("\n== STALE (Home, awake fixture, then steps + screen + DexScreener fail) ==");
  {
    const ctx = await newContext(browser, 390);
    const page = await ctx.newPage();
    const cors = { "access-control-allow-origin": "*" };
    let broken = false;
    await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}`, (r) => r.fulfill({ json: fixtureComputer(TOKEN_ID, "running"), headers: cors }));
    await page.route(`https://web-4.app/api/public/v1/computers/${TOKEN_ID}/steps`, (r) => (broken ? r.abort("failed") : r.fulfill({ json: fixtureSteps(), headers: cors })));
    await page.route(SCREEN_ROUTE, (r) =>
      broken ? r.fulfill({ status: 404, body: "" }) : r.fulfill({ status: 200, body: frameJpg, headers: { "content-type": "image/jpeg", "cache-control": "no-store" } }),
    );
    await page.route(/https:\/\/api\.dexscreener\.com\/.*/, (r) => (broken ? r.abort("failed") : r.continue()));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settled(page);
    await page.waitForFunction(() => [...document.querySelectorAll("img")].some((i) => i.src.includes("machine/frame") && i.naturalWidth > 0), null, { timeout: 15_000 }).catch(() => {});
    const before = await page.locator("#now").innerText();
    check(/\bLIVE\b/.test(before), "stale test: starts with a LIVE screen");
    broken = true;
    console.log("      waiting 32 s for the next poll with steps, screen and DexScreener failing…");
    await page.waitForTimeout(32_000);
    const now = await page.locator("#now").innerText();
    const status = await page.locator("#status").innerText();
    const market = await page.locator("#status dd").nth(2).innerText();
    check(!/\bLIVE\b/.test(now) && /Paused/i.test(now), `stale test: screen badge drops LIVE once frames stop loading (${now.match(/Paused|LIVE/i)?.[0] ?? "no badge"})`);
    check(status.includes("Can't reach Web4 right now."), "stale test: quiet can't-reach-Web4 line shown");
    check(/last seen/i.test(market), `stale test: market cap marked as stale after DexScreener fails (${market.replace(/\s+/g, " ")})`);
    await ctx.close();
  }

  // ---------- 3. OFFLINE: Home ----------
  console.log("\n== OFFLINE (Home, Web4 blocked) ==");
  {
    const ctx = await newContext(browser, 390);
    const page = await ctx.newPage();
    await page.route(/https:\/\/web-4\.app\/api\/.*/, (r) => r.abort("failed"));
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settled(page);
    const mood = await page.getAttribute("#status", "data-mood");
    const text = await page.locator("#status").innerText();
    check(mood === "unreachable" && text.includes("Can't tell right now"), "blocked from the start: honest \"Can't tell right now\" state");
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, 390);
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
    await settled(page);
    const before = await page.getAttribute("#status", "data-mood");
    await page.route(/https:\/\/web-4\.app\/api\/.*/, (r) => r.abort("failed"));
    console.log("      waiting 32 s for the next poll with Web4 blocked…");
    await page.waitForTimeout(32_000);
    const after = await page.getAttribute("#status", "data-mood");
    const text = await page.locator("#status").innerText();
    const thoughts = await page.locator("#now ol li").count();
    check(before === after && thoughts > 0, `blocked after a good load: keeps last good data (${before} → ${after}, ${thoughts} thoughts)`);
    check(text.includes("Can't reach Web4 right now. Showing what we last saw."), 'blocked after a good load: quiet "can\'t reach Web4" line shown');
    await page.locator("#status").screenshot({ path: `${SHOTS}/offline-keeps-last-home-390.png` });
    console.log(`      saved ${SHOTS}/offline-keeps-last-home-390.png`);
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(failures.length ? `\n${failures.length} check(s) FAILED` : "\nAll checks passed.");
process.exit(failures.length ? 1 : 0);
