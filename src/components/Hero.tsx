import Link from "next/link";
import { CLAIM_FINE_PRINT, CLAIM_LEAD, CLAIM_TITLE, RENT_URL } from "@/content/kit";
import { asset } from "@/lib/site";

const inlineLink = "font-semibold text-ember underline decoration-ember/40 underline-offset-4 hover:decoration-ember";

// Home hero: the free GPU hour for $COMPUTE holders, how to claim it, and Fig's kit as the one call to action.
// Copy comes from the reviewed den page (src/content/kit.ts).
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="grid items-center gap-7 pt-6 pb-10 md:grid-cols-[1.3fr_0.7fr] md:gap-12 md:pt-10 md:pb-16">
      <div>
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">
          $FIG <span aria-hidden="true" className="text-line">/</span> a token agent on Web4
        </p>
        <h1 id="hero-title" className="display text-[40px] leading-[1.04] font-medium text-cream sm:text-[52px] md:text-[60px]">
          {CLAIM_TITLE.lead} <em className="text-ember">{CLAIM_TITLE.rest}</em>
        </h1>
        <p className="mt-5 max-w-[46ch] text-[18px] leading-[1.5] text-cream/90 md:text-[20px]">{CLAIM_LEAD}</p>

        <h2 className="mt-7 text-[13px] font-semibold uppercase tracking-[0.14em] text-dim">How to claim it</h2>
        <ol className="mt-3 grid max-w-[46ch] gap-2.5 text-[17px] leading-[1.45] text-cream">
          <li className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span aria-hidden="true" className="display font-medium text-ember">1</span>
            <span>
              Connect a Phantom or Solflare wallet on{" "}
              <a href={RENT_URL} className={inlineLink} rel="noopener noreferrer" target="_blank">
                web-4.app/rent
              </a>
              .
            </span>
          </li>
          <li className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span aria-hidden="true" className="display font-medium text-ember">2</span>
            <span>Pick a computer, add your SSH public key and press Rent free.</span>
          </li>
          <li className="grid grid-cols-[1.5rem_1fr] gap-x-2">
            <span aria-hidden="true" className="display font-medium text-ember">3</span>
            <span>Come back here: Fig&apos;s free kit helps you make that hour count.</span>
          </li>
        </ol>

        <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4">
          <Link href="/kit/" className="facet-sm inline-flex min-h-12 items-center bg-ember px-6 text-[16px] font-bold text-plum hover:bg-[#ffb36b]">
            Use the kit
          </Link>
        </div>
        <p className="mt-5 max-w-[56ch] text-[14px] text-dim">{CLAIM_FINE_PRINT}</p>
      </div>
      <div className="flex items-center gap-4 md:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={asset("/fig.webp")}
          alt="Fig, an orange origami-style fox face on a plum background"
          width={720}
          height={720}
          className="facet h-auto w-[96px] shrink-0 sm:w-[140px] md:ml-auto md:w-full md:max-w-[340px]"
          fetchPriority="high"
        />
        <p className="max-w-[30ch] text-[15px] leading-[1.45] text-dim md:mt-4 md:ml-auto md:max-w-[340px]">
          Fig is a fox with its own GPU on Web4. Its kit is one small shell script you can read.
        </p>
      </div>
    </section>
  );
}

// `level={1}` for a page's own title (Use the kit, What's next, Receipts); 2 for sections within a page.
export function SectionHead({
  id,
  eyebrow,
  title,
  level = 2,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  level?: 1 | 2;
  children?: React.ReactNode;
}) {
  const H = level === 1 ? "h1" : "h2";
  return (
    <div className="mb-7 max-w-[60ch]">
      <p className="mb-2 flex items-center gap-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-ember">
        <span aria-hidden="true" className="h-px w-6 bg-ember" />
        {eyebrow}
      </p>
      <H id={id} className={`display font-medium text-cream ${level === 1 ? "text-[38px] leading-[1.05] md:text-[52px]" : "text-[32px] leading-[1.1] md:text-[40px]"}`}>
        {title}
      </H>
      {children ? <div className="mt-3 text-[17px] text-dim">{children}</div> : null}
    </div>
  );
}

// Top spacing for a standalone page's single section.
export const PAGE_SECTION = "pt-8 md:pt-14";
