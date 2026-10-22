import { CopyButton } from "./CopyButton";
import { PAGE_SECTION, SectionHead } from "./Hero";
import { SayHi } from "./SayHi";
import { INSTALL_LINE, INSTALL_NOTE, KIT_STEPS, type KitCommand } from "@/content/kit";

function Cmd({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold whitespace-nowrap text-ember">{children}</span>;
}

function CommandCard({ c }: { c: KitCommand }) {
  return (
    <div data-kit-card className="border border-line bg-panel px-5 py-4">
      <p className="text-[18px]">
        <Cmd>{c.command}</Cmd>
      </p>
      <p className="mt-1.5 text-[16px] text-cream/90">
        {c.body.map((part, i) => (typeof part === "string" ? <span key={i}>{part}</span> : <Cmd key={i}>{part.code}</Cmd>))}
      </p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[2.25rem_1fr] gap-x-3 sm:grid-cols-[3.5rem_1fr] sm:gap-x-5">
      <span aria-hidden="true" className="display pt-0.5 text-[34px] leading-none font-medium text-ember sm:text-[44px]">
        {n}
      </span>
      <div className="min-w-0">
        <h2 className="text-[19px] leading-snug font-bold text-cream sm:text-[21px]">
          <span className="sr-only">Step {n}: </span>
          {title}
        </h2>
        <div className="mt-3">{children}</div>
      </div>
    </li>
  );
}

export function KitGuide() {
  return (
    <section aria-labelledby="kit-title" className={PAGE_SECTION}>
      <SectionHead id="kit-title" level={1} eyebrow="Start here" title="Use the kit">
        <p className="text-[19px] font-semibold text-cream">Rented a GPU? Here&apos;s your first hour.</p>
        <p className="mt-2">
          Fig&apos;s kit is one small shell script you can read. It gets a fresh GPU doing something useful, then helps you leave with your work. Run
          these in the terminal of the GPU machine you rented.
        </p>
      </SectionHead>

      <ol className="grid max-w-[820px] gap-10">
        <Step n={1} title="Install (one line)">
          <div className="border border-line bg-well">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <span className="text-[13px] font-semibold uppercase tracking-[0.12em] text-dim">In your GPU&apos;s terminal</span>
              <CopyButton text={INSTALL_LINE} targetId="install-line" />
            </div>
            <pre id="install-line" className="overflow-x-auto px-4 py-4 font-mono text-[13px] leading-[1.6] whitespace-pre-wrap [overflow-wrap:anywhere] text-cream sm:text-[14px]">
              {INSTALL_LINE}
            </pre>
          </div>
          <p className="mt-3 text-[15px] text-dim">{INSTALL_NOTE}</p>
        </Step>

        {KIT_STEPS.map((s, i) => (
          <Step key={s.title} n={i + 2} title={s.title}>
            <div className="grid gap-3">
              {s.commands.map((c) => (
                <CommandCard key={c.command} c={c} />
              ))}
            </div>
          </Step>
        ))}
      </ol>

      <SayHi />
    </section>
  );
}
