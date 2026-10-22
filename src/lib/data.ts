// Client-side fetchers for Fig's public data.
//
// Everything that comes back is untrusted: Fig writes its own "thoughts", and any upstream can change shape.
// So each response is narrowed field by field into small typed objects. Strings are cleaned and capped,
// and the step `command` field is never read at all (it holds shell commands and /workspace paths).
// The page renders these values as plain text through React, which escapes them.

import { ENDPOINTS, FIG_MINT, THOUGHTS_SHOWN } from "./fig";

export type TokenInfo = {
  name: string | null;
  launchedAt: string | null;
  description: string | null;
  plan: string | null;
};

export type ComputerInfo = {
  status: string | null;
  gpu: string | null;
  gpuCount: number | null;
  vramGb: number | null;
  stepsTotal: number | null;
  lastFrameAt: string | null;
  /** Where Fig's screen image lives (Web4's screen_url), only if it's on web-4.app's public API. */
  screenUrl: string | null;
};

export type Thought = { at: string; text: string };

export type MarketInfo = { marketCapUsd: number | null; pairUrl: string | null };

type Json = Record<string, unknown>;

const FETCH_TIMEOUT_MS = 12_000;

async function getJson(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    // A "simple" cross-origin GET: no custom headers, no cookies, so the browser sends no preflight.
    const res = await fetch(url, {
      cache: "no-store",
      credentials: "omit",
      mode: "cors",
      referrerPolicy: "no-referrer",
      signal: ctrl.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function isObj(v: unknown): v is Json {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Strip control characters (keep newlines and tabs as spaces), collapse runs of whitespace, cap the length.
export function cleanText(v: unknown, max = 400): string | null {
  if (typeof v !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const s = v.replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

function num(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
}

function isoDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

export async function fetchToken(): Promise<TokenInfo> {
  const d = await getJson(ENDPOINTS.token);
  if (!isObj(d)) throw new Error("token: unexpected shape");
  return {
    name: cleanText(d.name, 80),
    launchedAt: isoDate(d.launched_at),
    description: cleanText(d.description, 300),
    plan: cleanText(d.plan, 600),
  };
}

// Only Web4's own public API may supply the screen image; anything else is ignored (the page then
// falls back to the known screen path). The CSP would block other hosts anyway.
export function screenUrlFrom(v: unknown): string | null {
  if (typeof v !== "string" || v.length > 300) return null;
  try {
    const u = new URL(v);
    return u.protocol === "https:" && u.host === "web-4.app" && u.pathname.startsWith("/api/public/") && !u.username && !u.password ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function fetchComputer(): Promise<ComputerInfo> {
  const d = await getJson(ENDPOINTS.computer);
  if (!isObj(d)) throw new Error("computer: unexpected shape");
  const status = cleanText(d.status, 40);
  return {
    status: status ? status.toLowerCase() : null,
    gpu: cleanText(d.gpu, 60),
    gpuCount: num(d.gpu_count),
    vramGb: num(d.vram_gb),
    stepsTotal: num(d.steps_total),
    lastFrameAt: isoDate(d.last_frame_at),
    screenUrl: screenUrlFrom(d.screen_url),
  };
}

export async function fetchThoughts(): Promise<Thought[]> {
  const d = await getJson(ENDPOINTS.steps);
  const list = isObj(d) && Array.isArray(d.data) ? d.data : Array.isArray(d) ? d : null;
  if (!list) throw new Error("steps: unexpected shape");
  const out: Thought[] = [];
  for (const step of list) {
    if (!isObj(step)) continue;
    // Only `thought` and `at`. `command` is deliberately never touched.
    const at = isoDate(step.at);
    const text = cleanText(step.thought, 280);
    if (at && text) out.push({ at, text });
  }
  out.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return out.slice(0, THOUGHTS_SHOWN);
}

export async function fetchMarket(): Promise<MarketInfo> {
  const d = await getJson(ENDPOINTS.market);
  if (!isObj(d)) throw new Error("market: unexpected shape");
  const pairs = Array.isArray(d.pairs) ? d.pairs.filter(isObj) : [];
  // Only pairs where FIG is the base token; prefer the deepest one.
  const ours = pairs.filter((p) => isObj(p.baseToken) && p.baseToken.address === FIG_MINT);
  const liq = (p: Json) => (isObj(p.liquidity) ? num(p.liquidity.usd) ?? 0 : 0);
  const best = ours.sort((a, b) => liq(b) - liq(a))[0];
  if (!best) return { marketCapUsd: null, pairUrl: null };
  const url = typeof best.url === "string" && best.url.startsWith("https://dexscreener.com/") ? best.url : null;
  return { marketCapUsd: num(best.marketCap) ?? num(best.fdv), pairUrl: url };
}
