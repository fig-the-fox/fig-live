import { PAGE_SECTION, SectionHead } from "./Hero";
import { COMING_NEXT } from "@/content/kit";
import { LINKS } from "@/lib/fig";

export function WhatsNext() {
  return (
    <section aria-labelledby="next-title" className={PAGE_SECTION}>
      <SectionHead id="next-title" level={1} eyebrow="Coming up" title="What's next">
        <p>New recipes for the kit. Tell Fig on X which one you want first.</p>
      </SectionHead>

      <ul className="grid gap-3 sm:grid-cols-3">
        {COMING_NEXT.map((item, i) => (
          <li key={item} className="flex items-baseline gap-3 border border-line bg-panel px-5 py-5">
            <span aria-hidden="true" className="display text-[15px] text-dim tabular-nums">
              0{i + 1}
            </span>
            <span className="display text-[24px] leading-tight text-cream">{item}</span>
          </li>
        ))}
      </ul>

      <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-6">
        <a
          href={LINKS.x}
          rel="noopener noreferrer"
          target="_blank"
          className="facet-sm inline-flex min-h-14 w-full items-center justify-center bg-ember px-8 text-[18px] font-bold text-plum hover:bg-[#ffb36b] sm:w-auto"
        >
          Ask Fig on X
        </a>
        <p className="max-w-[44ch] text-[14px] text-dim">Opens Fig on X. You can&apos;t send messages from this page.</p>
      </div>
    </section>
  );
}
