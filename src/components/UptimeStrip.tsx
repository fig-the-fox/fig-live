// Last-24-hours strip on Home. Read at BUILD time from public/uptime.json (made by
// scripts/build-uptime.mjs), so it's a snapshot, and the page says so. The status card above
// it stays live. The file is validated here; anything unexpected means "not available".

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { UptimeView, type Uptime, type UptimeState } from "./UptimeView";

const STATES: readonly UptimeState[] = ["awake", "napping", "between", "unknown", "no_data"];

function load(): Uptime | null {
  try {
    const d: unknown = JSON.parse(readFileSync(join(process.cwd(), "public/uptime.json"), "utf8"));
    if (typeof d !== "object" || d === null) return null;
    const o = d as Record<string, unknown>;
    const iso = (v: unknown) => (typeof v === "string" && Number.isFinite(Date.parse(v)) ? v : null);
    const generatedAt = iso(o.generated_at);
    const windowStart = iso(o.window_start);
    const windowEnd = iso(o.window_end);
    const buckets = Array.isArray(o.buckets) && o.buckets.every((b) => STATES.includes(b as UptimeState)) ? (o.buckets as UptimeState[]) : null;
    const bucketMinutes = typeof o.bucket_minutes === "number" && o.bucket_minutes > 0 ? o.bucket_minutes : null;
    if (!generatedAt || !windowStart || !windowEnd || !buckets || buckets.length === 0 || !bucketMinutes) return null;
    return { generatedAt, windowStart, windowEnd, buckets, bucketMinutes };
  } catch {
    return null;
  }
}

export function UptimeStrip() {
  return <UptimeView data={load()} />;
}
