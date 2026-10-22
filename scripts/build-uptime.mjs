// Builds public/uptime.json: Fig's last 24 hours as 144 ten-minute blocks (awake / napping /
// between computers), from the read-only log of Fig's local watcher. Runs before every build
// (npm "prebuild"). The page shows it as a snapshot: "history as of <generated_at>".
//
// Source: FIG_WATCH_LOG, or ~/atlas/agents/terminal/data/fig-watch/log.jsonl. One JSON line per
// watcher tick (every ~2 min); each tick carries `at` (UTC) and `status` (Web4's computer.status).
// Rule: each block shows the last status the watcher saw by the end of that block. A block whose
// latest reading is more than 30 minutes old shows as "no data" (watcher off, or before launch).
//
// If the log isn't there (e.g. a cloud build), the existing public/uptime.json is left alone and the
// page says history isn't available. The output never contains local paths, token ids or mints.

import { readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const LOG = process.env.FIG_WATCH_LOG ?? join(homedir(), "atlas/agents/terminal/data/fig-watch/log.jsonl");
const OUT = "public/uptime.json";
const BUCKET_MIN = 10;
const BUCKETS = 144; // 24 h
const STALE_MIN = 30;

// Same words as the live status card (src/lib/status.ts). `built` is awake but idle.
const STATE = { running: "awake", built: "awake", sleeping: "napping", not_started: "between" };

let raw;
try {
  raw = await readFile(LOG, "utf8");
} catch {
  console.warn("build-uptime: watcher log not found; leaving public/uptime.json as it is (the page copes without it)");
  process.exit(0);
}

const ticks = [];
for (const line of raw.split("\n")) {
  if (!line.trim()) continue;
  try {
    const d = JSON.parse(line);
    const t = Date.parse(d.at);
    if (Number.isFinite(t) && typeof d.status === "string") ticks.push({ t, status: d.status });
  } catch {
    // skip a malformed line rather than fail the build
  }
}
ticks.sort((a, b) => a.t - b.t);

const now = Date.now();
const step = BUCKET_MIN * 60_000;
const end = Math.floor(now / step) * step; // last whole 10-minute boundary
const start = end - BUCKETS * step;

const buckets = [];
let i = 0;
let last = null;
for (let b = 0; b < BUCKETS; b++) {
  const bEnd = start + (b + 1) * step;
  while (i < ticks.length && ticks[i].t <= bEnd) last = ticks[i++];
  if (!last || bEnd - last.t > STALE_MIN * 60_000) buckets.push("no_data");
  else buckets.push(STATE[last.status] ?? "unknown");
}

const minutes = { awake: 0, napping: 0, between: 0, unknown: 0, no_data: 0 };
for (const s of buckets) minutes[s] += BUCKET_MIN;

const lastReading = ticks.length ? ticks[ticks.length - 1].t : null;
const out = {
  generated_at: new Date(now).toISOString(),
  window_start: new Date(start).toISOString(),
  window_end: new Date(end).toISOString(),
  bucket_minutes: BUCKET_MIN,
  last_reading_at: lastReading ? new Date(lastReading).toISOString() : null,
  buckets,
  minutes,
  method:
    "Each 10-minute block shows the last computer status Web4 reported to Fig's watcher by the end of that block. Blocks with no reading in the 30 minutes before show as no data.",
};

const text = JSON.stringify(out, null, 2) + "\n";
// Belt and braces: nothing local or identifying may leave this machine in the snapshot.
const forbidden = [homedir(), "/Users/", "atlas", "35e13b19", "CJ3M8Vj8", "web-4.app", "log.jsonl"];
const hit = forbidden.find((f) => text.includes(f));
if (hit) throw new Error(`build-uptime: refusing to write ${OUT}; it would contain "${hit}"`);

await writeFile(OUT, text);
const fmt = (m) => `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}`;
console.log(
  `build-uptime: wrote ${OUT} (${ticks.length} readings; awake ${fmt(minutes.awake)}, napping ${fmt(minutes.napping)}, between ${fmt(minutes.between)}, no data ${fmt(minutes.no_data)})`,
);
