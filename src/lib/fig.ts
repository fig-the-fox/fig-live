// Fixed facts about Fig. Public identifiers only; nothing secret lives in this repo.
export const FIG_TOKEN_ID = "35e13b19-858d-480c-8779-ad25bc6f4d45";
export const FIG_MINT = "CJ3M8Vj8xB65XvcUXvfMf8XmjxazMtUpgKZQtCiAweb4";

export const WEB4_API = "https://web-4.app/api/public/v1";
export const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/tokens";

export const LINKS = {
  web4Project: `https://web-4.app/project/${FIG_TOKEN_ID}`,
  x: "https://x.com/AskFigFox",
  dexscreener: `https://dexscreener.com/solana/${FIG_MINT}`,
} as const;

export const ENDPOINTS = {
  token: `${WEB4_API}/tokens/${FIG_TOKEN_ID}`,
  computer: `${WEB4_API}/computers/${FIG_TOKEN_ID}`,
  steps: `${WEB4_API}/computers/${FIG_TOKEN_ID}/steps`,
  // Fig's screen. The computer's own screen_url is preferred (data.ts); this is the same path as a fallback.
  // Not the /v1/ frame path: on 2026-10-21 that answered 404 while Fig was running, and this one served frames.
  screen: `https://web-4.app/api/public/machine/frame?id=${FIG_TOKEN_ID}`,
  market: `${DEXSCREENER_API}/${FIG_MINT}`,
} as const;

export const POLL_MS = 30_000;
// The screen badge says LIVE only while the newest frame Web4 reports is younger than this.
export const LIVE_FRAME_MAX_AGE_MS = 2 * 60_000;
// A frame dated further in the future than this means the visitor's clock (or Web4's) is off, so the
// page can't tell how fresh it is and won't say LIVE.
export const CLOCK_SKEW_TOLERANCE_MS = 30_000;
export const THOUGHTS_SHOWN = 4;
