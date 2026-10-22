"use client";

import { useEffect, useState } from "react";
import { clockTime, timeAgo } from "@/lib/time";

export type UptimeState = "awake" | "napping" | "between" | "unknown" | "no_data";
export type Uptime = { generatedAt: string; windowStart: string; windowEnd: string; buckets: UptimeState[]; bucketMinutes: number };

// Height + colour both carry the state, so it reads without relying on colour alone.
const LOOK: Record<UptimeState, { label: string; bar: string; swatch: string }> = {
  awake: { label: "Awake", bar: "h-full bg-ember", swatch: "h-3 bg-ember" },
  napping: { label: "Napping", bar: "h-[60%] bg-dim/60", swatch: "h-2 bg-dim/60" },
  between: { label: "Between computers", bar: "h-[38%] bg-rust", swatch: "h-1.5 bg-rust" },
  unknown: { label: "Other", bar: "h-[38%] bg-dim/30", swatch: "h-1.5 bg-dim/30" },
  no_data: { label: "No data", bar: "h-[3px] bg-line", swatch: "h-[3px] bg-line" },
};

function duration(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function UptimeView({ data }: { data: Uptime | null }) {
  // Times are shown in the visitor's zone, so they're filled in after mount (the static HTML has none).
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => setNow(Date.now()), []);

  if (!data) {
    return (
      <section aria-label="Last 24 hours" className="mt-3 border border-line px-5 py-4 text-[14px] text-dim sm:px-8">
        Uptime history isn&apos;t included in this build. The status above is live.
      </section>
    );
  }

  const runs: Array<{ state: UptimeState; count: number }> = [];
  for (const s of data.buckets) {
    const last = runs[runs.length - 1];
    if (last && last.state === s) last.count++;
    else runs.push({ state: s, count: 1 });
  }
  const minutes = Object.fromEntries((Object.keys(LOOK) as UptimeState[]).map((s) => [s, 0])) as Record<UptimeState, number>;
  for (const s of data.buckets) minutes[s] += data.bucketMinutes;
  const shown = (Object.keys(LOOK) as UptimeState[]).filter((s) => s === "awake" || s === "napping" || s === "between" || minutes[s] > 0);
  const summary = `Last 24 hours: ${shown.map((s) => `${LOOK[s].label.toLowerCase()} ${duration(minutes[s])}`).join(", ")}.`;

  return (
    <section aria-labelledby="uptime-title" className="mt-3 border border-line bg-panel/50 px-5 pt-4 pb-5 sm:px-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[13px] text-dim">
        <h2 id="uptime-title" className="font-semibold uppercase tracking-[0.14em]">
          Last 24 hours
        </h2>
        <p>
          History as of <time dateTime={data.generatedAt}>{now ? clockTime(data.generatedAt, now) : "…"}</time>
          {now ? <span className="text-dim/70"> · {timeAgo(data.generatedAt, now)}</span> : null}
        </p>
      </div>

      <div role="img" aria-label={summary} className="mt-4 flex h-10 items-end gap-[2px]">
        {runs.map((r, i) => (
          <div key={i} className="flex h-full min-w-[2px] items-end" style={{ flexGrow: r.count, flexBasis: 0 }}>
            <div className={`w-full ${LOOK[r.state].bar}`} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[12px] text-dim/70 tabular-nums">
        <span>{now ? clockTime(data.windowStart, now) : ""}</span>
        <span>{now ? clockTime(data.windowEnd, now) : ""}</span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-cream">
        {shown.map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden="true" className="flex h-3 w-3 items-end">
              <span className={`w-full ${LOOK[s].swatch}`} />
            </span>
            {LOOK[s].label} <span className="text-dim">{duration(minutes[s])}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12px] text-dim/70">
        A snapshot from Fig&apos;s watcher, not live: it covers the 24 hours before the time above. Each block is 10 minutes. The status above is live.
      </p>
    </section>
  );
}
