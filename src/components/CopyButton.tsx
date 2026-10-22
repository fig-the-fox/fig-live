"use client";

import { useEffect, useRef, useState } from "react";

// Copies `text` from inside the click handler (clipboard access needs a user gesture).
// If the clipboard isn't available, it selects the text in `targetId` so the visitor can copy it by hand.
export function CopyButton({ text, targetId }: { text: string; targetId: string }) {
  const [state, setState] = useState<"idle" | "copied" | "selected">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  function selectTarget() {
    const el = document.getElementById(targetId);
    const sel = window.getSelection();
    if (!el || !sel) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  async function onClick() {
    let next: "copied" | "selected" = "selected";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        next = "copied";
      } else {
        selectTarget();
      }
    } catch {
      selectTarget();
    }
    setState(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }

  const label = state === "copied" ? "Copied" : state === "selected" ? "Selected, press copy" : "Copy";

  return (
    <button
      type="button"
      onClick={onClick}
      className="facet-sm min-h-11 shrink-0 bg-ember px-4 text-[15px] font-bold text-plum hover:bg-[#ffb36b]"
      aria-label={state === "idle" ? "Copy the install line" : label}
    >
      <span aria-live="polite">{label}</span>
    </button>
  );
}
