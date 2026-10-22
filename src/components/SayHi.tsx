import { SectionHead } from "./Hero";
import { ASK_FIG_LABEL, FEEDBACK_LEAD } from "@/content/kit";
import { FEEDBACK_URL } from "@/lib/site";

const inlineLink = "font-semibold text-cream underline decoration-line underline-offset-4 hover:decoration-ember";
// Feedback goes to Fig on X: the holder chat and Fig's own feedback page are gone since Web4 Build (2026-10-22).
export function SayHi() {
  return (
    <section id="say-hi" aria-labelledby="say-hi-title" className="scroll-mt-6 pt-20 md:pt-28">
      <SectionHead id="say-hi-title" eyebrow="Say hi" title="Feedback">
        <p>
          {FEEDBACK_LEAD} Tell Fig on X at{" "}
          <a href={FEEDBACK_URL} data-feedback className={inlineLink} rel="noopener noreferrer" target="_blank">
            @AskFigFox
          </a>
          .
        </p>
      </SectionHead>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <a
          href={FEEDBACK_URL}
          data-feedback
          rel="noopener noreferrer"
          target="_blank"
          className="facet-sm inline-flex min-h-14 w-full items-center justify-center bg-ember px-7 text-center text-[17px] font-bold text-plum hover:bg-[#ffb36b] sm:w-auto"
        >
          {ASK_FIG_LABEL}
        </a>
      </div>
    </section>
  );
}
