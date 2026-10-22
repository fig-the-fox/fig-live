# Fig Live

A human-friendly holder page for **Fig the Fox ($FIG)**, a token agent on Web4. Web4's own project page is a wall of chat logs, build logs and a screen share. Fig Live wraps the same public data in plain English for someone arriving from X on their phone, and answers four questions:

1. **What is Fig?** A fox with its own GPU on Web4, building a free kit for the free GPU hour $COMPUTE holders get every day.
2. **Is it awake?** Awake / Awake (idle) / Napping / Between computers, with "since" and the GPU.
3. **What is it doing right now, and what's next?** Fig's newest notes, its live screen (or a "Fig is napping" card), and the recipes coming next.
4. **How do I use the kit?** The four-step start-here guide, with a copy button on the install line.

Status: **ready, not yet the published app.** Fig's current Web4 page is a simpler den. Fig Live replaces it once Web4 Build's GitHub sync ships (October 2026), with this repo as the source. The Vercel recipe at the end is an optional backup host.

The older `build:web4` tarball path (see [Web4 build](#web4-build-figs-app-page)) was for Web4's previous agent-computer model and is kept for reference.

## Pages

A small top nav with the Fig Live mark sits on every page. On phones the four links get their own row, and they fit at 390 px; the row can scroll sideways if a narrower screen ever needs it. Routes use trailing slashes (`trailingSlash: true`), so each page exports as `<path>/index.html`, and `serve` answers `/kit` and `/kit/` alike.

| Page | Path | Content | Data |
|---|---|---|---|
| Home | `/` | Hero: "Hold $COMPUTE? You get a free GPU hour every day.", the den's claim sentence, **How to claim it** in three steps (Phantom or Solflare on web-4.app/rent; pick a computer, add your SSH public key, Rent free; come back for the kit), the **Use the kit** button, and a fine-print line (daily reset at midnight UTC, one computer at a time, the disk is deleted at release). Fig's face with "Fig is a fox with its own GPU on Web4." **Fig right now**: status in plain words, "since" (from `last_frame_at`), GPU, launch date, market cap (small, DexScreener), raw Web4 status and step count in small print, "Updated Xs ago". **Last 24 hours**: a strip of awake / napping / between computers in 10-minute blocks, labelled "history as of …" (a build-time snapshot). **What Fig is doing**: the 4 newest thoughts plus the live screen when awake, or a napping / between-computers card. **Feedback** (the den's Feedback section): Fig's own feedback page and "Ask Fig or vote in the holder chat" | **live**, polled every 30 s (the uptime strip is a snapshot) |
| Use the kit | `/kit/` | The 4 steps, copied exactly from the reviewed den page; copy button on the install line; a link to Fig's own **Install guide** (`install.html`, which lives beside the site on Fig's computer); the same **Feedback** section at the end; "If Fig is napping, the download may not work until it wakes. The same goes while Fig is between computers." plus a link to Home for live status | static |
| What's next | `/next/` | Make images · Transcribe audio · Fine-tune a model, and a big **Chat with Fig / vote** button to Fig's Web4 page | static |
| Receipts | `/receipts/` | Versions and full SHA-256 fingerprints, the review note (v0.2.0 failed and was pulled), Fig's own unchecked timings | static |

The footer on every page has @AskFigFox on X, **Ask Fig or vote in the holder chat** (Fig's Web4 page, the feedback route holders asked for), DexScreener, and "Not affiliated with Web4. Not financial advice." On phones it also repeats the page links.

Only Home loads the polling code; the build ships it in Home's chunk alone, and the verification checks that the other three pages make zero API calls. Because the kit page is static, its download note always shows rather than reacting to Fig's state. Fig's `plan` text from Web4 isn't shown anywhere (it's null today, and What's next is static).

Static copy lives in `src/content/kit.ts`. Its install line, versions and kit commands come from Fig's official kit repo, [fig-the-fox/fig-kit](https://github.com/fig-the-fox/fig-kit); the release commit and every script fingerprint are vendored in `scripts/fig-kit-release.json`, and `npm run verify:web4` fails if `kit.ts` drifts from them. The hero's free-hour claims also stay inside the "safe to say" list of `~/atlas/agents/fig/docs/research/2026-10-21-free-gpu-hour-facts.md`: never "no signature", never "2M = 2h". When a new kit version ships, update `scripts/fig-kit-release.json` (commit and fingerprints) and `kit.ts` together.

### Status words

Web4 has two different "off" states. On 2026-10-21 its public tokens list showed 9 tokens `sleeping` and two (FIG and GAME) `not_started`.

| Web4 `computer.status` | Meaning | Shown as |
|---|---|---|
| `running` | Computer on, Fig working | **Awake**, live screen |
| `built` | Computer on, idle | **Awake (idle)**, live screen |
| `sleeping` | Web4 paused the GPU because things were quiet; it wakes when needed | **Napping**, "Fig is napping" card |
| `not_started` | No computer assigned: the old machine stopped and Web4's replacement rental hasn't started | **Between computers**: "Fig's old computer stopped. Web4 is renting it a new one; Fig picks up when it arrives." |
| anything else | Unknown | **Not sure**, with the raw value in small print |
| Web4 unreachable on first load | | **Can't tell right now** |

The raw status always shows in small print. Today (2026-10-21) Fig is `not_started`, so the live page reads **Between computers**.

### Uptime strip (snapshot)

`scripts/build-uptime.mjs` runs before every build (`prebuild`). It reads Fig's local watcher log, read-only (`FIG_WATCH_LOG`, default `~/atlas/agents/terminal/data/fig-watch/log.jsonl`). The log has one line per tick, about every 2 minutes, and every tick carries Web4's computer `status`, so no inference from transitions is needed. The script writes `public/uptime.json`:

- 144 ten-minute blocks covering the 24 hours before the build, with `generated_at`, the window, `last_reading_at`, minutes per state, and a one-line method.
- Each block shows the last status the watcher saw by the end of that block. A block whose latest reading is more than 30 minutes old is "no data" (before launch, or the watcher was off).
- `running` and `built` count as awake, `sleeping` as napping, `not_started` as between computers.
- The script refuses to write if the output would contain a local path, username, token id, mint or Web4 URL.

Home reads the file at build time and says "History as of <time>", and that the status above is live. The file is gitignored because it changes on every build. Without the log (a cloud build, say), the strip says the history isn't included. On 2026-10-21 at 13:16 ET it showed awake 15 h 50 min, between computers 5 h 20 min, and no data 2 h 50 min (before launch).

The strip shows Web4's *reported* status. Web4 still said `running` until 11:57 UTC, although Fig's last screen frame was at 11:34 UTC.

## Share card

`npm run og` (`scripts/build-og.mjs`) renders a 1200×630 card from Fig's face in `public/`: "Fig Live", "A fox with its own GPU on Web4", and no prices. It saves the card as `src/app/opengraph-image.png` and `twitter-image.png`, with alt text. Next emits `og:*` and `twitter:*` tags (`summary_large_image`, @AskFigFox) with absolute URLs from `metadataBase`.

`SITE_URL` is read at build time and defaults to **`https://fig-live.vercel.app`, a placeholder** until the creator picks a domain. Build with `SITE_URL=https://<domain>` once the domain is chosen, or share cards will point at the placeholder.

## Security headers

`vercel.json` sets these for every path:

| Header | Value |
|---|---|
| `Content-Security-Policy` | The page's meta CSP plus `frame-ancestors 'none'` |
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | Camera, microphone, geolocation, payment, USB and topics all off |

The page's meta referrer matches the header. The data fetches to Web4 and DexScreener still send no referrer.

`npm run preview` derives `serve.local.json` from `vercel.json`, so the local preview sends the same headers and the browser checks exercise them. `verify.mjs` fails in any of these cases:

- The meta CSP and `vercel.json` drift apart.
- The preview's headers differ from `vercel.json`.
- `/kit` doesn't redirect to `/kit/`.
- The site renders inside another page's iframe.

## Data sources

Everything live is fetched **by the visitor's browser** straight from public APIs. There's no server, proxy, key or local file at runtime.

| What | Endpoint | Works cross-origin? |
|---|---|---|
| Name, launch date, plan | `GET https://web-4.app/api/public/v1/tokens/{id}` | Yes: HTTP 200, `access-control-allow-origin: *` |
| Status, GPU, VRAM, steps total, last frame time | `GET https://web-4.app/api/public/v1/computers/{id}` | Yes: HTTP 200, `access-control-allow-origin: *` |
| Newest 25 steps (only `thought` and `at` are read) | `GET https://web-4.app/api/public/v1/computers/{id}/steps` | Yes: HTTP 200, `access-control-allow-origin: *` |
| Live screen | `<img src="{screen_url}">`, the computer's own `screen_url` (`https://web-4.app/api/public/machine/frame?id={id}`, no `/v1/`) | An image, so CORS doesn't apply. Requested only while Fig is awake (`running` or `built`). |
| Market cap | `GET https://api.dexscreener.com/latest/dex/tokens/{mint}` | Yes: HTTP 200, `access-control-allow-origin: *` |

These results come from `scripts/verify.mjs` in headless Chrome against the live APIs on 2026-10-21. The fetches are "simple" GETs (no custom headers, no cookies), so the browser sends no preflight. Web4 accepted browser user agents. (Fig Ops notes a 403 for some server-side user agents, which doesn't affect browsers.)

Token id `35e13b19-858d-480c-8779-ad25bc6f4d45`, mint `CJ3M8Vj8xB65XvcUXvfMf8XmjxazMtUpgKZQtCiAweb4`.

The screen comes from the computer response's `screen_url`. It's accepted only if it's an https URL on web-4.app under `/api/public/`; otherwise the page uses the same path built from the token id. The `/v1/machine/frame` path the page used before answered 404 HTML while Fig was `running` (2026-10-21, 18:30–19:00 ET), while `screen_url` served fresh JPEGs; Terminal's watcher has always used `screen_url`. `screen_url` returns the **last** frame even while Fig is asleep, so the page only asks for it while Fig is awake. It says LIVE only while that frame is fresh (see Behaviour).

### Behaviour

- Home polls every 30 s. The poll pauses while the tab is in the background and catches up when you come back. The other pages don't poll.
- A failed fetch keeps the last good data and shows a quiet "Can't reach Web4 right now. Showing what we last saw."
- The live screen preloads each new frame off-screen and swaps it in, so it never flashes blank.
- The screen badge says **LIVE** only while the picture is fresh: Web4's `last_frame_at` for that picture is under 2 minutes old, its load didn't fail, and Web4 is still answering. Otherwise it says **Paused**, and the caption gives the picture's age ("This is the last picture, from 10 min ago."). A frame dated more than 30 s in the future means a clock is off, so it can't count as fresh: Paused, with "this device's clock looks off". Napping and between-computers states show their cards and never ask for a frame.
- All upstream text is untrusted. Each response is narrowed field by field, strings are cleaned of control characters and capped, and everything renders as plain React text. There's no `dangerouslySetInnerHTML`, and the step `command` field is never read.
- Production builds carry a meta Content-Security-Policy that only allows connections to Web4 and DexScreener, and images from the site itself and Web4. On Vercel the same policy also arrives as a header (see Security headers).
- Times show in the visitor's own time zone.

## Run it

```bash
npm install
npm run build          # refreshes public/uptime.json, then static export to out/
npm run preview        # serves out/ on http://127.0.0.1:3421 (localhost only) with the vercel.json headers
npm run verify         # needs the preview running; see below
npm run og             # re-render the share card (only when the design changes)

npm run build:web4     # Fig's app page: export under /app/FIG to out-web4/, then pack dist-web4/
npm run verify:web4    # kit parity, package, the Fig command against a simulated /workspace/public, browser
npm run preview:web4   # serve the packed tarball like web-4.app does: http://127.0.0.1:3431/app/FIG/
node scripts/fig-command.mjs https://<host>/fig-live-web4.tgz.b64   # print Fig's one-line install command
```

`npm run dev` runs the dev server on 127.0.0.1:3422.

### Verification (`scripts/verify.mjs`)

This drives headless Google Chrome through Playwright and exits non-zero if any check fails. The last run on 2026-10-21 (19:30 ET) passed **242 of 242** checks. Fig was `running`, and Home showed its real screen from `screen_url`. The run before the screen fix (18:40 ET) failed 2 checks: the old `/v1/` frame path answered 404 HTML, which Chrome blocked as a cross-origin image (ORB). The base commit `42e4fc3` failed the same 2 at the same moment.

0. **Headers.**
   - `vercel.json`'s CSP equals the page's meta CSP plus `frame-ancestors 'none'`.
   - The preview sends exactly the `vercel.json` headers.
   - `/kit` redirects to `/kit/`.
   - `/uptime.json` has 144 blocks and contains no local paths or ids.
   - The site won't render inside another page's iframe.
1. **Live, no mocks, every page at 390 and 1280 px.**
   - Every page:
     - The nav shows 4 links, with the right one marked current.
     - The h1 and title are right, and heading levels never skip.
     - Keyboard focus rings are visible on the clipped (facet) buttons.
     - None of the real step commands appear.
     - No console errors, CSP violations, failed requests, or horizontal scroll.
   - **Home, uptime strip:** shows "history as of …" with the snapshot's age, and says the status above is live.
   - **Home:** each of the four JSON fetches returns 200 with `access-control-allow-origin: *` in the browser, and real data renders (status, 3–5 thoughts, market cap, step count). The hero has only "Use the kit", pointing to `/kit/`.
   - **Kit, What's next, Receipts:** zero API calls.
   - **Kit:** 4 steps, and the copy button puts the exact install line on the clipboard (compared with the source constant, including the two spaces `sha256sum -c` needs).
   - **What's next:** the 3 recipes, and the vote button links to Fig's Web4 page.
   - **Receipts:** all 4 versions with full fingerprints, the review note and the measurements.
   - **Navigation:** the nav link and the hero button work.
2. **Fixture: every Web4 state on Home (dev-only).** `scripts/fixtures/web4.mjs` stands in for Web4's computer, steps and screen through Playwright request interception. **It is never imported by the app and is not in `out/`.** It runs `running`, `built`, `sleeping` and `not_started` at both widths, plus an unknown `starting` at 390. For each, it checks the label, the plain sentence, the raw status in small print, and the live screen vs the napping or between card. Awake states must load the screen from the API's `screen_url` (the fixture's carries an extra parameter, so it can't be confused with the fallback), never ask the `/v1/` frame path, and show LIVE for a seconds-old frame. A `running` state whose frame is 10 minutes old must show Paused with "from 10 min ago", and one whose frame is dated 15 minutes in the future must show Paused with the clock line. Home and the kit page must link Fig's feedback page. A `screen_url` pointing off Web4 must be ignored in favour of Web4's own screen path. It also checks that a sentinel in the `command` field never reaches the DOM, and that HTML inside a thought shows as literal text and never runs. Every fixture screenshot is labelled "TEST FIXTURE".
   The unknown status must never be described as napping or asleep.
2b. **Stale (Home).** Start awake, then make steps, the screen and DexScreener fail. On the next poll:
   - The screen badge drops from LIVE to Paused, and the caption dates the last picture.
   - The quiet "can't reach Web4" line appears.
   - The market cap says when it was last seen.
3. **Offline (Home).** With Web4 blocked from the start, the page shows "Can't tell right now". With Web4 blocked after a good load, it keeps the last data and shows the quiet line on the next poll.

### Second-model review (2026-10-21)

Run with `codex-exec.sh --effort medium --label fig-live-review`: read-only, exit 0, 42 s.

**Verdict:** no injection from upstream text and no private-data leak in the source or the export.

It found 0 HIGH, 4 MEDIUM and 3 LOW issues. Each MEDIUM was first reproduced by a failing check (13 red), then fixed (194 green):

| Severity | Finding | Fix |
|---|---|---|
| MEDIUM | An unknown status was called napping or asleep | Neutral wording |
| MEDIUM | A stale market cap looked current | "Last seen … ago" |
| MEDIUM | The LIVE badge stayed up while frames failed | Paused, with the picture dated |
| MEDIUM | `clip-path` cut off the focus ring on the facet buttons | Ring drawn inside the edge |
| LOW | Kit headings skipped a level | Fixed |
| LOW | The uptime copy claimed "saved this build" | Shows the snapshot's age instead |
| LOW | Both CSPs allow `'unsafe-inline'` scripts | **Deferred** (see below) |

Why the CSP item is deferred: replacing `'unsafe-inline'` with script hashes needs a post-build step, because Next's inline bootstrap scripts change on every build. Do it before the page ever renders HTML from upstream.

### Screenshots (`docs/screens/`)

| File | What |
|---|---|
| `home-390.png`, `home-1280.png` | Home with real data (Fig `not_started`, so "Between computers") |
| `kit-390.png`, `kit-1280.png` | Use the kit |
| `next-390.png`, `next-1280.png` | What's next |
| `receipts-390.png`, `receipts-1280.png` | Receipts |
| `fixture-awake-home-390.png`, `fixture-awake-home-1280.png` | **Mocked** awake Home (fixture, not real data) |
| `fixture-state-{running,built,sleeping,not_started}-390.png` | **Mocked** status card and screen area in each Web4 state |
| `offline-keeps-last-home-390.png` | Status card after Web4 became unreachable |

## Deploying to Vercel (not done; waits for the creator's OK and a running GPU)

Everything is in place: static output, `vercel.json` headers, share card, placeholder `SITE_URL`. Nothing has been linked or deployed. The installed CLI is `vercel` 55.0.0.

**Build locally, then upload the build.** A cloud build can't see the watcher log, so its uptime strip would say "not included".

One-time setup (creates the Vercel project, so it needs the creator's OK):

```bash
cd ~/projects/fig-live
vercel login                      # the creator's Vercel account
vercel link --yes                 # creates/links the "fig-live" project; writes .vercel/ (gitignored)
```

The deploy command the creator would approve (Fig's GPU running, Home showing "Awake"):

```bash
vercel pull --yes --environment=production && SITE_URL=https://fig-live.vercel.app vercel build --prod && vercel deploy --prebuilt --prod
```

Custom domain, once picked:

1. `vercel domains add <domain> fig-live`, or Project → Settings → Domains.
2. Point DNS as Vercel says: a `CNAME` to `cname.vercel-dns.com` for a subdomain, or an `A` record to `76.76.21.21` for an apex domain.
3. Re-run the deploy command with `SITE_URL=https://<domain>` so the share cards point at it.

After the deploy:

- Run `node scripts/verify.mjs https://<url>`. The header-vs-preview check then tests Vercel's real headers. The fixture and offline checks also run, because they intercept requests in the browser.
- The uptime strip is frozen at deploy time. Redeploy to refresh it.
- The APIs send `access-control-allow-origin: *`, so the new origin needs no change. If Web4 ever narrows CORS, link out instead of adding a proxy.

No secrets are involved: the page uses only public, unauthenticated endpoints, and `SITE_URL` isn't secret.

## Web4 build: Fig's app page

Fig's GPU computer serves `/workspace/public` with a plain static file server on :8080, and Web4 proxies it at **https://web-4.app/app/FIG/** (also at `/app/<token id>/`). `FIG_LIVE_TARGET=web4` builds the same site for that:

| | Default build (`npm run build`) | Web4 build (`npm run build:web4`) |
|---|---|---|
| Paths | Site root | `basePath` and `assetPrefix` `/app/FIG`, trailing slashes. Next prefixes its own links and assets; plain `<img>` paths go through `asset()` in `src/lib/site.ts` |
| Output | `out/` | `out-web4/`, packed into `dist-web4/` |
| Uptime strip | Yes (from the watcher log on Terminal's machine) | **No**: that log doesn't exist there, and `uptime.json` is left out of the tarball |
| API calls | Absolute to `https://web-4.app/api/public/v1/…` and DexScreener | Same, and same-origin on Web4 |
| Install guide link | `https://web-4.app/app/FIG/install.html` | `/app/FIG/install.html` (same site; resolves to `/app/FIG/install.html` from every page) |
| Footer | "no login and no tracking" | "adds no tracking of its own; Web4, which hosts it, adds its own analytics" (web-4.app injects two analytics scripts into every page) |
| Build id | Random (Next's default) | A hash of the inputs, so the same source always packs to the same bytes |

### The package (`dist-web4/`, gitignored)

`npm run build:web4` runs the web4 build and then `scripts/pack-web4.mjs`, which writes:

- `fig-live-web4.tgz`: 1,168,811 bytes on 2026-10-21, sha256 `35ceb9548916e29a5313194174b74c3f77e5391e80b143530cdc31409f1ba98b`. It holds 42 files and 17 directories: `index.html`, `index.txt`, `kit/`, `next/`, `receipts/`, `404/`, `404.html`, `_next/`, `fig.webp` and the icon/share images.
- `fig-live-web4.tgz.b64` (base64, 76 columns) and `SHA256SUMS` (both files).

The tarball is plain ustar: entries sorted (each directory before its contents), one fixed mtime, root:root, 0644/0755, no macOS `._` files, gzip without name or time. A clean rebuild gave the identical sha256. The packer refuses to write if two packs differ, if the tarball is over 2 MB, if any path falls outside `[A-Za-z0-9._/-]`, or if the export holds any `.sh`, `install.html`, `feedback.html` or `kit-files/` path. Those are Fig's own files in `/workspace/public`, and none of them exist on Fig's server under our names today (checked 2026-10-21; `index.html`, the den, is the only file we replace).

### The Fig command (`node scripts/fig-command.mjs <url of the .b64>`)

It prints one line (Web4's creator chat sends on newline and caps messages near 1,000 characters). With the planned host, `https://gist.githubusercontent.com/<owner>/<gist-id>/raw/fig-live-web4.tgz.b64` (105 characters), it's **855 characters**; the verifier fails above 860. The URL is used unquoted, so `fig-command.mjs` only accepts https URLs made of letters, digits and `._~:/%+=,@-` (no `?`, `&`, quotes or spaces). In order:

1. It downloads the `.b64` into a fresh temp dir, decodes it and checks the sha256. The hash pins the exact bytes the verifier checked, so the command doesn't re-check file names.
2. It extracts the tarball, lists its files, and keeps a dated copy of the den: `index.fig-backup-<time>.html`.
3. It copies everything in with GNU `cp --backup=simple -S .flb`, which keeps a `<file>.flb` copy of each file it replaces.
4. It asks Fig's own server whether `/kit/` serves the kit page and whether a JS chunk and the stylesheet come back as JavaScript and CSS. How that server handles directories and MIME types can't be seen from outside, because web-4.app answers every unknown path with `200` and the den.
5. On success it deletes this run's `.flb` copies and prints `FIG-LIVE-OK`. On any failure in steps 3–4 it puts every replaced file back and prints `FIG-LIVE-ROLLED-BACK`, or `FIG-LIVE-ROLLBACK-FAILED` if a restore failed. It exits non-zero either way.

All backup handling goes through the release's own file list, never a scan of `public/`, so nothing of Fig's can match. Files that are new in a release stay behind after a rollback; nothing links to them. To fit the length limit, `index.html` is copied with everything else, so for the moment the copy takes it can arrive before its chunks.

### Verification (`npm run verify:web4`, i.e. `scripts/verify-web4.mjs`)

The last run on 2026-10-21 (19:34 ET) passed **208 of 208** checks. `--deploy-only` skips the browser; `--live https://web-4.app/app/FIG/` runs the browser checks against the real page after a deploy.

- **Kit parity.** `kit.ts` against the vendored kit release (`scripts/fig-kit-release.json`): the install line has exactly one URL, the release commit's file for the main version; the hash it echoes is that file's release fingerprint; it keeps `sha256sum -c` with no sudo and no pipe to a shell; every receipt matches the release under its own version; and the kit cards include doctor, chat, persona, notebook, timer and save.
- **Package.**
  - It's ≤ 2 MB, and the sums and base64 (Node and the system `base64 -d`) match.
  - Repacking `out-web4/` gives the same bytes.
  - The system tar and Python's `tarfile` list the same entries: sorted, one mtime, root:root, plain files and directories only.
  - There are no forbidden names, no `uptime.json` and no local paths. No page has a root path without `/app/FIG`.
- **Deploy.** The exact Fig command runs under GNU coreutils (Homebrew's, via a PATH shim) against a simulated `/workspace/public`. That folder holds the den as `index.html` plus fake `install.html`, `fig-v0.2.2.sh`, `fig.sh` (a symlink) and `kit-files/`, served by a stand-in for Fig's server. It must:
  - install and leave Fig's files byte-for-byte untouched, back up the den and leave no `.flb` behind;
  - on an update whose check fails, or whose copy fails part-way, restore every replaced file (a second test release also changes payloads, CSS and an image);
  - do the same under `dash`;
  - leave stray `.flb` files in `kit-files/` alone;
  - say `FIG-LIVE-ROLLBACK-FAILED` when a restore can't finish;
  - judge JS by an app chunk, not a leftover manifest from an older build;
  - stop when `mktemp` fails, with nothing written to `$HOME`;
  - roll back to the den when JS comes back as `text/plain`;
  - change nothing on a sha256 mismatch.

  The fake files now include Fig's `feedback.html`, which must also come through untouched.
- **Browser, 390 and 1280 px, every page,** through `scripts/serve-web4.mjs`. It stands in for Web4: it proxies `/app/FIG/` to the Fig-server stand-in, adds Web4's headers (`nosniff`, `frame-ancestors 'self'`) and injects stub versions of Web4's two analytics scripts. Misses are 404 and logged. Every page must have:
  - no misses or 4xx;
  - the right content-type per asset, and every same-origin request under `/app/FIG/`;
  - no console errors and no failed requests;
  - the stubs running alongside React;
  - nav under `/app/FIG/` with trailing slashes;
  - none of the never-say claims;
  - the holder chat link and the analytics footer.

  Home must have the hero claim with exactly two links (Use the kit, web-4.app/rent), no uptime strip, live data, and, while Fig is awake, its real screen loaded from `screen_url`. On the kit page, the install line on the page and on the clipboard must be byte-identical to the den's `<pre>`, and the cards must match the den. Client-side navigation must reach every page and show its heading. All 10 distinct links must resolve.
- **Extras.**
  - `/app/<token id>/` renders with every asset.
  - The Install guide opens `/app/FIG/install.html`, and its "Back to Main Guide" link (`index.html`) lands on a working Home.
  - With today's 200-and-index fallback, `/app/FIG/kit` without the slash shows Home, with no errors.

Two exemptions, each stated where it's applied:

- **The live-screen frame.** If Web4's screen endpoint answers 404 HTML while Fig is `running`, Chrome blocks that cross-origin image (ORB). It is cross-origin only in this local test. The check then requires the page's "screen isn't showing" card. Since the switch to `screen_url` this hasn't triggered: the last run loaded Fig's real screen at both widths.
- **`/favicon.ico` from Fig's `install.html`.** That page has no icon link, so Chrome asks for `/favicon.ico`, which web-4.app also answers 404. The request belongs to Fig's page, not this site.

Screenshots: `docs/screens-web4/{home,kit,next,receipts}-{390,1280}.png` (real data through the local Web4 stand-in).

### Second-model review of the web4 work (Codex, read-only, 2026-10-21)

| Round | Finding | Fix (each one first reproduced by a failing test) |
|---|---|---|
| 1 | HIGH: a failed `cp` skipped the rollback | Copy moved inside the rollback group |
| 1 | MEDIUM: rollback restored only `index.html`, so an update could end mixed | `cp --backup` keeps every replaced file and rollback restores them all |
| 1 | LOW: the client-side nav check passed without the destination heading | It now waits for the heading. A mutation run (kit payload swapped for Home's) showed the old check passing and the new one failing |
| 2 | HIGH: cleanup and rollback scanned all of `public/` for `*.flb`, which could touch Fig's `kit-files/` | Both work only on the release's own file list |
| 2 | MEDIUM: a failed cleanup ran rollback without backups | Cleanup runs only after the checks pass, outside rollback |
| 2 | MEDIUM: "rolled back" was printed even when a restore failed | `FIG-LIVE-ROLLBACK-FAILED` |
| 2 | MEDIUM: the update test changed only HTML | Release B also changes payloads, CSS, an image, and adds a file |
| 3 | None. All four round-2 fixes confirmed | |
| 4 (screen_url + command trim) | MEDIUM: a frame dated in the future read as LIVE | Past 30 s of skew it reads Paused, "clock looks off" |
| 4 | MEDIUM: the shortened JS glob could test a leftover build manifest instead of an app chunk | Glob narrowed to `_next/*/c*/*.js` |
| 4 | LOW: a failed `mktemp` sent the unquoted `cd` to `$HOME` | `T=$(mktemp -d)&&cd $T` |
| 4 | LOW: the live screen checks matched only the endpoint prefix | They compare with the API's `screen_url` |
| 5 | None. All four round-4 fixes and the Feedback change confirmed | |

### Before and after a deploy (open items)


- **Feedback route.** The den's Feedback section exists because Web4's audit kept asking Fig for one. Fig Live carries it (Home and kit page link Fig's `feedback.html`, which the tarball never touches), so swapping the den for Fig Live keeps the route the audit looks for.
- **Fig is rewriting `index.html` itself.** Its own notes at 18:27–18:36 ET say it's writing "the comprehensive index.html … working feedback form". Its agent loop may overwrite Fig Live, or Fig Live may overwrite its work. Tell Fig in the same message that `index.html` is now Fig Live and not to edit it.
- **`install.html` disagrees with the den's receipts.** Fig's `install.html` (live 2026-10-21) has the right v0.2.2 hash, but different hashes for v0.1.2 and v0.1.1 than the den and Fig Live. Its install line also uses `~/bin` and the `/app/<token id>/` URL; it still checks the sha256. The kit page links it because it was asked for. Fig should fix its table.
- **Web4 injects its own `og:image`/`twitter:image`** after ours, so link previews may show Web4's image.
- **After the deploy:** run `node scripts/verify-web4.mjs --live https://web-4.app/app/FIG/`. Check `https://web-4.app/app/FIG/kit` without the slash; with Web4's fallback it shows Home, and none of our links use it.

## Layout

```
src/app/            layout (fonts, CSP, share metadata, nav + footer), page.tsx (Home), kit/, next/, receipts/, globals.css, icons, opengraph/twitter images
src/components/     Nav, Hero, LiveProvider (30 s poll, Home only), StatusStrip, UptimeStrip + UptimeView, DoingNow, SayHi, KitGuide, CopyButton, WhatsNext, Receipts, Footer
src/lib/            fig.ts (ids, endpoints), site.ts (build target, base path, asset(), SITE_URL), pages.ts (nav order), data.ts (validated fetchers), status.ts (status words), time.ts
vercel.json         static hosting config + security headers (never deployed yet)
src/content/kit.ts  reviewed static copy (install line, steps, versions, notes)
scripts/            verify.mjs + fixtures/web4.mjs (dev-only, never shipped), build-uptime.mjs, build-og.mjs, serve-config.mjs
                    web4: pack-web4.mjs (tarball), fig-command.mjs (Fig's one-liner), serve-web4.mjs + verify-web4.mjs (tests)
public/fig.webp     Fig's face (from 2026-10-20-fig-token-final.png, resized)
```

Brand: plum `#2b1430`, panels `#45203f`, borders `#5c2c55`, orange `#FFA24A` / `#E0662A`, cream `#F5EEE6`, dim `#D6C4D2`. The display font is Fraunces (soft), the body font is Figtree, and mono is used only for the install line and hashes. Fonts are self-hosted at build time. The corners of the facet shapes echo Fig's origami face.
