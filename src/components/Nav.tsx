"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PAGES } from "@/lib/pages";
import { asset } from "@/lib/site";

const norm = (p: string) => (p.length > 1 && p.endsWith("/") ? p.slice(0, -1) : p);

// Mark on the left, four short links. On phones the links get their own row that can scroll
// sideways if a very narrow screen ever needs it (at 390 px they all fit).
export function Nav() {
  const path = norm(usePathname() ?? "/");
  return (
    <header className="flex flex-col gap-1 pt-4 pb-2 md:flex-row md:items-center md:justify-between md:gap-6 md:py-5">
      <Link href="/" className="flex w-fit items-center gap-2.5 py-1">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("/fig.webp")} alt="" width={32} height={32} className="facet-sm h-8 w-8" />
        <span className="display text-[20px] leading-none text-cream">
          Fig <span className="text-ember">Live</span>
        </span>
      </Link>
      <nav aria-label="Pages" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0">
        <ul className="flex min-w-max items-center gap-x-5 border-b border-line md:gap-x-7 md:border-b-0">
          {PAGES.map((p) => {
            const active = norm(p.href) === path;
            return (
              <li key={p.href}>
                <Link
                  href={p.href}
                  aria-current={active ? "page" : undefined}
                  className={`-mb-px inline-flex min-h-11 items-center border-b-2 text-[15px] font-semibold whitespace-nowrap ${
                    active ? "border-ember text-cream" : "border-transparent text-dim hover:text-cream"
                  }`}
                >
                  {p.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </header>
  );
}
