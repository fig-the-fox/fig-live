"use client";

import { useEffect, useState } from "react";
import { useLive } from "./LiveProvider";
import { describeStatus, isAwake, type Mood } from "@/lib/status";
import { clockTime, compactUsd, shortDate, timeAgo } from "@/lib/time";
import { LINKS } from "@/lib/fig";

function Indicator({ mood }: { mood: Mood }) {
  if (mood === "awake") {
    return (
      <span aria-hidden="true" className="relative inline-flex h-4 w-4 items-center justify-center">
        <span className="pulse-ring absolute h-4 w-4 rounded-full bg-ember" />
        <span className="relative h-4 w-4 rounded-full bg-ember" />
      </span>
    );
  }
  if (mood === "idle") {
    return <span aria-hidden="true" className="inline-block h-4 w-4 rounded-full border-[3px] border-ember" />;
  }
  if (mood === "napping") {
    return (
      <span aria-hidden="true" className="display inline-flex items-end gap-0.5 text-dim italic">
        <span className="drift text-[18px] leading-none">z</span>
        <span className="drift-late text-[24px] leading-none">z</span>
      </span>
    );
  }
  if (mood === "between") {
    return (
      <span aria-hidden="true" className="inline-flex items-center gap-1">
        <span className="dot-1 h-2 w-2 rounded-full bg-ember" />
        <span className="dot-2 h-2 w-2 rounded-full bg-ember" />
        <span className="dot-3 h-2 w-2 rounded-full bg-ember" />
      </span>
    );
  }
  return <span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-dim/50" />;
}

// "Updated 12s ago" ticks every second on its own, so the rest of the page doesn't re-render each second.
function UpdatedAgo({ at }: { at: number | null }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!at || !now) return <span>Checking…</span>;
  const s = Math.max(0, Math.round((now - at) / 1000));
  return <span className="tabular-nums">Updated {s < 2 ? "just now" : s < 120 ? `${s}s ago` : `${Math.round(s / 60)} min ago`}</span>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[12px] font-semibold uppercase tracking-[0.12em] text-dim/80">{label}</dt>
      <dd className="mt-1 text-[16px] text-cream">{children}</dd>
    </div>
  );
}

export function StatusStrip() {
  const live = useLive();
  const { computer, token, market, now } = live;
  const unreachable = live.settled && !computer;
  const view = describeStatus(computer?.status ?? null);
  const awake = isAwake(view.mood);
  const label = unreachable ? "Can't tell right now" : view.label;

  const ago = now ? timeAgo(computer?.lastFrameAt ?? null, now) : "";
  const clock = now ? clockTime(computer?.lastFrameAt ?? null, now) : "";
  const off = view.mood === "napping" || view.mood === "between";
  let since = "";
  if (computer?.lastFrameAt && now) {
    if (awake) since = `Screen updated ${ago}`;
    else if (off) since = `Since ${clock} · ${ago}`;
    else since = `Last screen update ${clock} · ${ago}`;
  }

  let gpu = "—";
  if (computer) {
    const mem = computer.vramGb ? `${computer.vramGb} GB` : "";
    if (computer.gpu) gpu = [computer.gpu, mem].filter(Boolean).join(" · ");
    else if (view.mood === "between") gpu = "None assigned yet";
    else if (view.mood === "napping") gpu = "None attached while napping";
    else if (awake && mem) gpu = `${mem} GPU`;
    else gpu = "Not reported";
  }

  return (
    <section id="status" aria-labelledby="status-title" className="scroll-mt-6" data-mood={unreachable ? "unreachable" : view.mood} data-settled={live.settled ? "yes" : "no"}>
      <div className="ear border border-line bg-panel px-5 pt-5 pb-5 sm:px-8 sm:pt-7">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 text-[13px] text-dim">
          <h2 id="status-title" className="font-semibold uppercase tracking-[0.14em]">
            Fig right now
          </h2>
          <p aria-live="off">
            <UpdatedAgo at={live.web4At} />
            <span className="text-dim/70"> · checks every 30 s</span>
          </p>
        </div>

        <div className="mt-4 flex items-center gap-4" aria-live="polite">
          <Indicator mood={unreachable ? "unknown" : view.mood} />
          <p data-label className="display text-[40px] leading-[1.05] font-medium text-cream sm:text-[48px]">{label}</p>
        </div>
        {since ? <p className="mt-1 text-[16px] text-dim">{since}</p> : null}
        <p className="mt-3 max-w-[58ch] text-[17px] text-cream/90">
          {unreachable ? "This page couldn't reach Web4 to check on Fig. It will keep trying every 30 seconds." : view.sentence}
        </p>

        {live.web4Failing && !unreachable ? (
          <p role="status" className="mt-3 text-[15px] text-dim">
            Can&apos;t reach Web4 right now. Showing what we last saw.
          </p>
        ) : null}

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-5 sm:grid-cols-3">
          <Fact label="GPU">{gpu}</Fact>
          <Fact label="Launched">{token?.launchedAt ? shortDate(token.launchedAt) : "—"}</Fact>
          <Fact label="Market cap">
            {market?.marketCapUsd != null ? (
              <>
                {compactUsd(market.marketCapUsd)}{" "}
                <a
                  href={market.pairUrl ?? LINKS.dexscreener}
                  className="text-[13px] text-dim underline decoration-line underline-offset-4 hover:text-cream"
                  rel="noopener noreferrer"
                  target="_blank"
                >
                  DexScreener
                </a>
                {live.marketFailing && live.marketAt && now ? (
                  <span className="block text-[13px] text-dim">Last seen {timeAgo(new Date(live.marketAt).toISOString(), now)}; DexScreener isn&apos;t answering</span>
                ) : null}
              </>
            ) : live.settled ? (
              <a href={LINKS.dexscreener} className="text-dim underline decoration-line underline-offset-4" rel="noopener noreferrer" target="_blank">
                See DexScreener
              </a>
            ) : (
              "—"
            )}
          </Fact>
        </dl>

        <p className="mt-5 text-[12px] text-dim/70">
          {computer?.status ? (
            <>
              Web4 status: “{computer.status}”
              {computer.stepsTotal != null ? ` · ${computer.stepsTotal.toLocaleString("en-US")} steps taken since launch` : ""}
            </>
          ) : (
            "Web4 status: waiting for an answer"
          )}
        </p>
      </div>
    </section>
  );
}
