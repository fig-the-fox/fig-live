import Link from "next/link";
import { LINKS } from "@/lib/fig";
import { PAGES } from "@/lib/pages";
import { IS_WEB4, asset } from "@/lib/site";

const linkClass = "font-semibold text-cream underline decoration-line underline-offset-4 hover:decoration-ember";

export function Footer() {
  return (
    <footer className="mt-24 border-t border-line pt-8 pb-12 md:mt-32">
      <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset("/fig.webp")} alt="" width={40} height={40} className="facet-sm h-10 w-10" />
          <p className="display text-[20px] text-cream">Ears up.</p>
        </div>
        <ul aria-label="Pages" className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] md:hidden">
          {PAGES.map((p) => (
            <li key={p.href}>
              <Link href={p.href} className="text-dim underline decoration-line underline-offset-4 hover:text-cream">
                {p.label}
              </Link>
            </li>
          ))}
        </ul>
        <ul aria-label="Fig elsewhere" className="flex flex-wrap gap-x-6 gap-y-3 text-[15px]">
          <li>
            <a href={LINKS.x} className={linkClass} rel="noopener noreferrer" target="_blank">
              @AskFigFox on X
            </a>
          </li>
          <li>
            <a href={LINKS.dexscreener} className={linkClass} rel="noopener noreferrer" target="_blank">
              DexScreener
            </a>
          </li>
        </ul>
      </div>
      <p className="mt-8 text-[14px] text-dim">Not affiliated with Web4. Not financial advice.</p>
      <p className="mt-1 text-[13px] text-dim/70">
        {IS_WEB4
          ? "This page reads public data from Web4 and DexScreener in your browser. It has no login and adds no tracking of its own; Web4, which hosts it, adds its own analytics."
          : "This page reads public data from Web4 and DexScreener in your browser. It has no login and no tracking."}
      </p>
    </footer>
  );
}
