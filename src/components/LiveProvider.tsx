"use client";

// One shared poll for the whole page: every 30 s the visitor's browser asks Web4 and DexScreener
// for Fig's public data. A failed fetch never wipes what we already have; we keep the last good
// data and flag the failure so the page can say so quietly.

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { fetchComputer, fetchMarket, fetchThoughts, fetchToken } from "@/lib/data";
import type { ComputerInfo, MarketInfo, Thought, TokenInfo } from "@/lib/data";
import { POLL_MS } from "@/lib/fig";

export type LiveState = {
  token: TokenInfo | null;
  computer: ComputerInfo | null;
  thoughts: Thought[] | null;
  market: MarketInfo | null;
  /** When DexScreener last answered successfully (ms since epoch). */
  marketAt: number | null;
  /** When Web4 last answered successfully (ms since epoch). */
  web4At: number | null;
  /** True when the latest round could not reach Web4 (any of token / computer / steps). */
  web4Failing: boolean;
  marketFailing: boolean;
  /** The first round has finished, successfully or not. */
  settled: boolean;
  /** Bumps every successful computer poll; used to refresh the live screen. */
  round: number;
  /** A clock for "x min ago" labels; null until mounted so the static HTML never bakes in a time. */
  now: number | null;
};

const initial: LiveState = {
  token: null,
  computer: null,
  thoughts: null,
  market: null,
  marketAt: null,
  web4At: null,
  web4Failing: false,
  marketFailing: false,
  settled: false,
  round: 0,
  now: null,
};

const LiveContext = createContext<LiveState>(initial);

export const useLive = () => useContext(LiveContext);

export function LiveProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LiveState>(initial);
  const lastPoll = useRef(0);
  const inFlight = useRef(false);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll() {
      if (inFlight.current) return;
      inFlight.current = true;
      lastPoll.current = Date.now();
      const [token, computer, thoughts, market] = await Promise.allSettled([
        fetchToken(),
        fetchComputer(),
        fetchThoughts(),
        fetchMarket(),
      ]);
      inFlight.current = false;
      if (!alive) return;
      const web4Ok = token.status === "fulfilled" && computer.status === "fulfilled" && thoughts.status === "fulfilled";
      setState((s) => ({
        ...s,
        token: token.status === "fulfilled" ? token.value : s.token,
        computer: computer.status === "fulfilled" ? computer.value : s.computer,
        thoughts: thoughts.status === "fulfilled" ? thoughts.value : s.thoughts,
        market: market.status === "fulfilled" ? market.value : s.market,
        marketAt: market.status === "fulfilled" ? Date.now() : s.marketAt,
        web4At: computer.status === "fulfilled" ? Date.now() : s.web4At,
        web4Failing: !web4Ok,
        marketFailing: market.status === "rejected",
        settled: true,
        round: computer.status === "fulfilled" ? s.round + 1 : s.round,
        now: Date.now(),
      }));
    }

    function schedule() {
      timer = setTimeout(async () => {
        // Don't spend a phone's data while the tab is in the background.
        if (!document.hidden) await poll();
        if (alive) schedule();
      }, POLL_MS);
    }

    function onVisible() {
      if (!document.hidden && Date.now() - lastPoll.current >= POLL_MS) void poll();
    }

    void poll();
    schedule();
    const clock = setInterval(() => setState((s) => ({ ...s, now: Date.now() })), 15_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(clock);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <LiveContext.Provider value={state}>{children}</LiveContext.Provider>;
}
