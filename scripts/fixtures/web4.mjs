// DEV-ONLY TEST FIXTURE. Not real data, and never imported by the app.
// scripts/verify.mjs serves these through Playwright request interception to check how Home
// looks and behaves in each Web4 computer state (running, built, sleeping, not_started), since
// the real computer is only ever in one state when you test.
// Times are generated relative to "now" so the page's "x min ago" labels look realistic.

const ago = (s) => new Date(Date.now() - s * 1000).toISOString();

export const FIXTURE_COMMAND_SENTINEL = "FIXTURE_COMMAND_MUST_NOT_RENDER";
export const FIXTURE_XSS_THOUGHT = 'Testing escaping <img src=x onerror="window.__xss=1"> <b>bold?</b>';

// Where the fixture says Fig's screen lives. It carries an extra parameter, so it can't be mistaken for
// the page's built-in fallback URL: a check can prove the page used the API's screen_url.
export const fixtureScreenUrl = (tokenId) => `https://web-4.app/api/public/machine/frame?id=${tokenId}&fixture=1`;

// frameAgeS: how old last_frame_at is while the computer is on. screenUrl: what the API says screen_url is.
export function fixtureComputer(tokenId, status, { frameAgeS = 4, screenUrl = fixtureScreenUrl(tokenId) } = {}) {
  const on = status === "running" || status === "built";
  return {
    token_id: tokenId,
    gpu: on ? "NVIDIA GeForce RTX 3090" : null,
    gpu_count: 1,
    vram_gb: 24,
    status,
    last_frame_at: on ? ago(frameAgeS) : ago(3 * 3600),
    done: false,
    steps_total: 341,
    screen_url: screenUrl,
  };
}

export function fixtureSteps() {
  const step = (s, thought) => ({ at: ago(s), thought, command: `echo ${FIXTURE_COMMAND_SENTINEL} && ls /workspace` });
  return {
    data: [
      step(40, "[fixture] Run fig doctor on the fresh machine to confirm the GPU and CUDA show up."),
      step(160, "[fixture] Re-check the v0.2.2 kit file's fingerprint against the receipts table."),
      step(420, FIXTURE_XSS_THOUGHT),
      step(900, "[fixture] Write a short how-to for the chat recipe so first-timers know what to expect."),
      step(1500, "[fixture] Tidy the den page's install section."),
    ],
  };
}

// A stand-in "screen" image, drawn by the browser and clearly labelled as a fixture.
export const FRAME_HTML = `<!doctype html><html><body style="margin:0;width:1280px;height:720px;background:#0d0b10;color:#9fe3a1;font:22px/1.6 Menlo,monospace;display:flex;flex-direction:column;justify-content:center;padding:0 80px;box-sizing:border-box">
<div style="color:#ffa24a;font-size:28px;margin-bottom:24px">TEST FIXTURE · not Fig's real screen</div>
<div>$ fig doctor</div><div>GPU   NVIDIA GeForce RTX 3090 · 24 GB</div><div>CUDA  12.4</div><div>Disk  182 GB free</div><div>ready in 0.2 s</div>
</body></html>`;
