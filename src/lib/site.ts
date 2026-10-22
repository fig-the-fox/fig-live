// Build target and paths. FIG_LIVE_TARGET and FIG_BASE_PATH are inlined by next.config.ts at build time.
//
// - default: local preview and the Vercel copy, served from the site root.
// - web4: Fig's own app page, served by Fig's GPU computer and proxied by Web4 under /app/FIG/.
export const IS_WEB4 = process.env.FIG_LIVE_TARGET === "web4";

// "" for the default build, "/app/FIG" for web4. Next adds it to <Link> and its own assets by itself,
// but not to plain <img src>/<a href> paths, so those go through asset().
export const BASE_PATH = process.env.FIG_BASE_PATH ?? "";
export const asset = (path: `/${string}`) => `${BASE_PATH}${path}`;

// Where the site lives. Only feeds absolute URLs for share cards (Next adds the base path itself).
// Default build: PLACEHOLDER until the creator picks a domain; set SITE_URL when building
// (e.g. `SITE_URL=https://fig.example npm run build`). The web4 build lives on web-4.app.
export const SITE_URL = process.env.SITE_URL ?? (IS_WEB4 ? "https://web-4.app" : "https://fig-live.vercel.app");

// Feedback goes to Fig on X: Fig's old feedback.html and install.html (web-4.app/app/FIG) are gone since Web4 Build.
export const FEEDBACK_URL = "https://x.com/AskFigFox";

export const SHARE_TITLE = "Fig Live";
export const SHARE_DESCRIPTION = "A fox with its own GPU on Web4. See if Fig is awake, what it's doing, and how to use its free kit.";
