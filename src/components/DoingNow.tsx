"use client";

import { useEffect, useState } from "react";
import { useLive } from "./LiveProvider";
import { SectionHead } from "./Hero";
import { describeStatus, isAwake } from "@/lib/status";
import { clockTime, timeAgo } from "@/lib/time";
import { CLOCK_SKEW_TOLERANCE_MS, ENDPOINTS, LIVE_FRAME_MAX_AGE_MS } from "@/lib/fig";
import { asset } from "@/lib/site";

// Shown instead of the live screen whenever Fig's computer is off: napping (Web4 paused it)
// or between computers (no machine assigned yet).
function NappingCard({ lastSeen, between }: { lastSeen: string; between: boolean }) {
  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-4 border border-line bg-well px-6 text-center">
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/fig.webp")} alt="" width={84} height={84} className="facet-sm h-[72px] w-[72px] opacity-60 grayscale-[35%] sm:h-[84px] sm:w-[84px]" />
        {between ? (
          <span aria-hidden="true" className="absolute -right-6 bottom-1 inline-flex items-center gap-1">
            <span className="dot-1 h-1.5 w-1.5 rounded-full bg-ember" />
            <span className="dot-2 h-1.5 w-1.5 rounded-full bg-ember" />
            <span className="dot-3 h-1.5 w-1.5 rounded-full bg-ember" />
          </span>
        ) : (
          <span aria-hidden="true" className="display absolute -top-3 -right-5 text-dim italic">
            <span className="drift inline-block text-[16px]">z</span>
            <span className="drift-late inline-block text-[22px]">z</span>
          </span>
        )}
      </div>
      <div>
        <p className="display text-[24px] leading-tight text-cream">{between ? "Fig is between computers" : "Fig is napping"}</p>
        <p className="mt-1 text-[15px] text-balance text-dim">
          {between ? "No live screen while Fig's GPU is off." : "No live screen while its computer is off."}
          {lastSeen ? <span className="block">Last seen {lastSeen}.</span> : null}
        </p>
      </div>
    </div>
  );
}

function UnavailableCard({ text }: { text: string }) {
  return (
    <div className="flex aspect-video w-full items-center justify-center border border-line bg-well px-6 text-center">
      <p className="text-[15px] text-dim">{text}</p>
    </div>
  );
}

// The live screen is a plain <img> pointed at the computer's screen_url on Web4. Each poll preloads the
// next frame off-screen and swaps it in only once it has loaded, so the picture never flashes blank.
// "Live" is only claimed while the picture is fresh: the frame Web4 reported when it loaded is under
// 2 minutes old (and not dated in the future past a small tolerance), the newest load didn't fail, and
// Web4 is still answering. Otherwise the badge says "Paused" and the caption gives the picture's age,
// or says the device's clock looks off.
function frameSrc(screenUrl: string, round: number): string {
  const u = new URL(screenUrl);
  u.searchParams.set("t", `${round}-${Date.now()}`);
  return u.toString();
}

function LiveScreen({ screenUrl, lastFrameAt, round, stale, now }: { screenUrl: string; lastFrameAt: string | null; round: number; stale: boolean; now: number | null }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // last_frame_at as Web4 reported it when the picture on screen was fetched: that picture's age.
  const [shownFrameAt, setShownFrameAt] = useState<string | null>(null);

  // `round` and `lastFrameAt` change together (one state update per poll), so the value read here is the
  // one Web4 reported for this round. It's deliberately not a dependency: a new round starts each fetch.
  useEffect(() => {
    const next = frameSrc(screenUrl, round);
    const reported = lastFrameAt;
    const img = new Image();
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      setSrc(next);
      setFailed(false);
      setShownFrameAt(reported);
    };
    img.onerror = () => setFailed(true);
    img.src = next;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, screenUrl]);

  if (!src) return failed ? <UnavailableCard text="Fig is awake, but its screen isn't showing right now." /> : <UnavailableCard text="Loading Fig's screen…" />;
  const ageMs = shownFrameAt && now ? now - Date.parse(shownFrameAt) : null;
  // A negative age can't prove freshness: past a small tolerance, one of the clocks is wrong.
  const clockOff = ageMs !== null && ageMs < -CLOCK_SKEW_TOLERANCE_MS;
  const live = !failed && !stale && ageMs !== null && !clockOff && ageMs < LIVE_FRAME_MAX_AGE_MS;

  return (
    <figure className="w-full" data-screen={live ? "live" : "paused"}>
      <div className="relative border border-line bg-well">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="Fig's computer screen, from Web4" width={1280} height={720} referrerPolicy="no-referrer" className="block aspect-video h-auto w-full object-contain" />
        {live ? (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 bg-plum/85 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-ember">
            <span aria-hidden="true" className="h-2 w-2 rounded-full bg-ember" />
            Live
          </span>
        ) : (
          <span className="absolute top-3 left-3 inline-flex items-center gap-2 bg-plum/85 px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.14em] text-dim">
            <span aria-hidden="true" className="h-2 w-2 rounded-full border border-dim" />
            Paused
          </span>
        )}
      </div>
      <figcaption className="mt-2 text-[14px] text-dim">
        {live
          ? "Fig's screen, refreshed every 30 seconds."
          : clockOff
            ? "This page can't tell how fresh Fig's screen is: this device's clock looks off."
            : `Fig's screen isn't updating right now. This is the last picture${shownFrameAt && now ? `, from ${timeAgo(shownFrameAt, now)}` : ""}.`}
      </figcaption>
    </figure>
  );
}

export function DoingNow() {
  const { computer, thoughts, now, round, settled, web4Failing } = useLive();
  const view = describeStatus(computer?.status ?? null);
  const awake = isAwake(view.mood);
  const off = view.mood === "napping" || view.mood === "between";
  const lastSeen = now && computer?.lastFrameAt ? clockTime(computer.lastFrameAt, now) : "";

  let screen: React.ReactNode;
  if (!computer) screen = <UnavailableCard text={settled ? "Can't reach Web4 right now." : "Checking on Fig…"} />;
  else if (awake) screen = <LiveScreen screenUrl={computer.screenUrl ?? ENDPOINTS.screen} lastFrameAt={computer.lastFrameAt} round={round} stale={web4Failing} now={now} />;
  else if (off) screen = <NappingCard lastSeen={lastSeen} between={view.mood === "between"} />;
  else screen = <UnavailableCard text="No live screen right now. Web4 reported a status this page doesn't recognise yet." />;

  let intro = "Fig's own notes as it works, newest first.";
  if (computer && view.mood === "between") intro = "Fig's GPU is off right now. These are the last notes it wrote.";
  else if (computer && view.mood === "napping") intro = "Fig is asleep right now. These are the last notes it wrote before it dozed off.";
  else if (computer && !awake) intro = "Fig's most recent notes, newest first.";

  return (
    <section id="now" aria-labelledby="now-title" className="scroll-mt-6 pt-20 md:pt-28">
      <SectionHead id="now-title" eyebrow="Right now" title="What Fig is doing">
        <p>{intro}</p>
      </SectionHead>

      <div className="grid gap-8 md:grid-cols-[1.1fr_1fr] md:gap-10">
        <div>{screen}</div>

        <div>
          <h3 className="text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">{off ? "Last thoughts" : "Latest thoughts"}</h3>
          {thoughts === null ? (
            <p className="mt-4 text-[16px] text-dim">{settled ? "Couldn't load Fig's notes right now." : "Loading Fig's notes…"}</p>
          ) : thoughts.length === 0 ? (
            <p className="mt-4 text-[16px] text-dim">No notes yet.</p>
          ) : (
            <ol className="mt-4 border-l border-line">
              {thoughts.map((t, i) => (
                <li key={`${t.at}-${i}`} className="relative pb-5 pl-5 last:pb-0">
                  <span aria-hidden="true" className={`absolute top-[7px] -left-[5px] h-[9px] w-[9px] rounded-full ${i === 0 ? "bg-ember" : "border border-line bg-plum"}`} />
                  <p className="text-[13px] text-dim">
                    <time dateTime={t.at} className="font-semibold text-ember tabular-nums">
                      {now ? timeAgo(t.at, now) : ""}
                    </time>
                    {now ? <span className="text-dim/70"> · {clockTime(t.at, now)}</span> : null}
                  </p>
                  {/* Untrusted upstream text: rendered as a plain React string, never as HTML. */}
                  <p className="mt-1 text-[16px] leading-[1.5] break-words text-cream">{t.text}</p>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-5 text-[13px] text-dim/70">In Fig&apos;s own words, from Web4&apos;s public feed.</p>
        </div>
      </div>
    </section>
  );
}
