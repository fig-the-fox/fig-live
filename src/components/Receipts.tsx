import { PAGE_SECTION, SectionHead } from "./Hero";
import { MEASUREMENTS_NOTE, REVIEW_NOTE, VERSIONS } from "@/content/kit";

export function Receipts() {
  return (
    <section aria-labelledby="receipts-title" className={PAGE_SECTION}>
      <SectionHead id="receipts-title" level={1} eyebrow="Proof" title="Receipts">
        <p>{REVIEW_NOTE}</p>
      </SectionHead>

      <div className="max-w-[820px] border border-line">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">Kit versions and their SHA-256 fingerprints</caption>
          <thead>
            <tr className="bg-panel text-[12px] font-semibold uppercase tracking-[0.12em] text-dim">
              <th scope="col" className="w-[7.5rem] px-4 py-3 sm:w-[9rem]">
                Version
              </th>
              <th scope="col" className="px-4 py-3">
                Fingerprint (SHA-256)
              </th>
            </tr>
          </thead>
          <tbody>
            {VERSIONS.map((v) => (
              <tr key={v.version} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 text-[15px] font-semibold text-cream">
                  {v.version}
                  {v.main ? <span className="ml-2 bg-ember px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.08em] text-plum">main</span> : null}
                </th>
                <td className="px-4 py-3 font-mono text-[12.5px] leading-[1.55] break-all text-dim sm:text-[13px]">{v.sha256}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[70ch] text-[14px] text-dim">{MEASUREMENTS_NOTE}</p>
    </section>
  );
}
