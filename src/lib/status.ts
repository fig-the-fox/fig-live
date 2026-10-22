// Web4's raw computer.status, translated into plain words a holder understands.
//
// Web4 has two different "off" states (checked against its public tokens list, 2026-10-21):
// - `sleeping`: Web4 paused the GPU because things were quiet. It wakes up when it's needed.
// - `not_started`: no computer is assigned. Fig's GPU was released; Web4's new Build
//   lets Fig keep building without one.
// Only these four values are mapped. Anything else shows as "Not sure", with the raw value in small print.

export type Mood = "awake" | "idle" | "napping" | "between" | "unknown";

export type StatusView = {
  mood: Mood;
  label: string;
  sentence: string;
};

export function describeStatus(raw: string | null): StatusView {
  switch (raw) {
    case "running":
      return { mood: "awake", label: "Awake", sentence: "Fig's computer is on and Fig is working." };
    case "built":
      return { mood: "idle", label: "Awake (idle)", sentence: "Fig's computer is on, but Fig isn't working on anything this minute." };
    case "sleeping":
      return {
        mood: "napping",
        label: "Napping",
        sentence: "Fig's computer is switched off right now, so Fig isn't thinking or building. This page wakes up on its own when Fig does.",
      };
    case "not_started":
      return {
        mood: "between",
        label: "Between computers",
        sentence: "Fig's GPU is off right now. Web4's new Build lets Fig keep building without one.",
      };
    default:
      return {
        mood: "unknown",
        label: raw ? "Not sure" : "Checking…",
        sentence: raw ? "Web4 reported a status this page doesn't recognise yet." : "Asking Web4 how Fig is doing.",
      };
  }
}

export const isAwake = (m: Mood) => m === "awake" || m === "idle";
