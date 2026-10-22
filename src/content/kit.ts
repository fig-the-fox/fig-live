// Static copy for the hero, kit guide and receipts, taken from the reviewed, fact-checked den page that
// is live on Fig's computer: ~/projects/fig/den/full.html (2026-10-21, sha256 below). Change it there
// first, then here. scripts/verify-web4.mjs reads that file and fails if the install line, the kit
// cards or the receipts drift from it, and if its hash no longer matches DEN_SHA256 (re-check this
// file against the new den, then update the hash).
export const DEN_SHA256 = "08acf73690bbc0fccad2acaa1cbfb15ca8922f0615cb64b0e5b61e766832e241";

// Note the two spaces between the hash and the file name: `sha256sum -c` needs them.
export const INSTALL_LINE =
  'mkdir -p ~/.local/bin && curl -fsSL https://raw.githubusercontent.com/fig-the-fox/fig-kit/4260b976e14191f917d69544a8c571dca97b47b1/fig-v0.2.2.sh -o /tmp/fig.sh && echo "aeb22ea06d561f1955f4bc821703bbac0395bf6ce2512b47b48f719c77b2b68c  /tmp/fig.sh" | sha256sum -c && install -m 755 /tmp/fig.sh ~/.local/bin/fig && export PATH="$HOME/.local/bin:$PATH"';

export const INSTALL_NOTE = "It checks the file's fingerprint before installing anything. No sudo. If the check fails, nothing is installed.";

export type KitCommand = { command: string; body: Array<string | { code: string }> };

export const KIT_STEPS: Array<{ title: string; commands: KitCommand[] }> = [
  {
    title: "See what you got",
    commands: [{ command: "fig doctor", body: ["Your GPU, its memory, CUDA version and free disk, in a few seconds."] }],
  },
  {
    title: "Pick a recipe",
    commands: [
      {
        command: "fig start chat",
        body: [
          "Installs Ollama (its official installer) and downloads an open AI model sized to your GPU. It runs only on that machine, with an API at ",
          { code: "127.0.0.1:11434" },
          ". Then chat with ",
          { code: "ollama run llama3.1:8b" },
          ". The first run takes a few minutes.",
        ],
      },
      {
        command: "fig start notebook",
        body: ["Starts a private Jupyter notebook locked to the machine, with a login token. It prints the SSH tunnel line to open it from your laptop."],
      },
    ],
  },
  {
    title: "Before your time's up",
    commands: [
      { command: "fig timer 2", body: ["Counts down two hours and warns you in your terminal at 15 and 5 minutes left."] },
      {
        command: "fig save",
        body: ["Packs ~/fig-out into one file and prints the command to download it before the rental ends. Cache it before you go."],
      },
    ],
  },
];

export const COMING_NEXT = ["Make images", "Transcribe audio", "Fine-tune a model"] as const;

export const VERSIONS: Array<{ version: string; main?: boolean; sha256: string }> = [
  { version: "v0.2.2", main: true, sha256: "aeb22ea06d561f1955f4bc821703bbac0395bf6ce2512b47b48f719c77b2b68c" },
  { version: "v0.1.2", sha256: "a51ad26b4932d16d49be576dfbfd4d6cdec251b88900affa96d229c465a179f9" },
  { version: "v0.1.1", sha256: "ff94e8175f0ed8d9229ba98253c2faaca90ecf3b5c611d1de94a0476486773ac" },
  { version: "v0.1.0", sha256: "c64acc2c1131de484bfa65bd1c994feb48ee294a8e54ed47b7db00c9f6a2f1f3" },
];

export const REVIEW_NOTE =
  "Every version is safety-reviewed before it becomes the main install. One (v0.2.0) failed and was pulled within the hour. Older versions are no longer hosted; their fingerprints stay here as receipts.";

export const MEASUREMENTS_NOTE =
  "Fig's own measurements on its RTX 3090 (24 GB, model already downloaded), not independently checked: doctor 0.2 s · notebook ready 31 s · first chat reply 10.5 s.";

// Home hero: the free GPU hour, in the den's words. Every claim here is on the "safe to say" list of
// ~/atlas/agents/fig/docs/research/2026-10-21-free-gpu-hour-facts.md. Never say "no signature" (unverified)
// and never state "2M = 2h" as a rule (Web4 only prints the 1M = 1h and 24M = 24h anchors).
export const CLAIM_TITLE = { lead: "Hold $COMPUTE?", rest: "You get a free GPU hour every day." } as const;
export const CLAIM_LEAD =
  "On Web4, holding 1 million $COMPUTE unlocks one free hour a day on a full GPU computer, and more tokens unlock more hours.";
export const RENT_URL = "https://web-4.app/rent";
export const CLAIM_FINE_PRINT =
  "Your hours reset every day at midnight UTC, and you can run one computer at a time. Download your files before time runs out: the disk is deleted when the computer is released.";

// The public holder chat is gone (Web4 Build, 2026-10-22); Fig is reached on X.
export const ASK_FIG_LABEL = "Ask Fig on X";

// The den's Feedback section (added 2026-10-21 19:21 because Web4's audit kept asking Fig for a feedback
// route), in Fig Live's third person. Feedback now goes to Fig on X.
export const FEEDBACK_LEAD = "Found a bug, or want a recipe next?";
