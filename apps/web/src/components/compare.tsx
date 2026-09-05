import Link from "next/link";
import { compareRows, compareValues } from "@/lib/specs";
import { tierOrder, tiers, formatPrice, type TierId } from "@/lib/site";

export function Compare({ current }: { current?: TierId }) {
  return (
    <section id="compare" data-theme="white" className="bg-white text-ink">
      <div className="mx-auto max-w-[1100px] px-6 py-20 lg:px-10">
        <h2 className="font-display text-[32px] font-medium tracking-[-0.02em] md:text-[38px]">
          Three boxes. One platform.
        </h2>
        <p className="mt-2 max-w-[560px] text-[14px] text-ash">
          Same chassis, same screen, same software. The module and storage set the ceiling.
        </p>
        <p className="mt-2 max-w-[560px] text-[14px] text-ash">
          Weighing a NAS, a Home Assistant Green, a Mac mini or a cloud assistant instead?{" "}
          <Link href="/#why-not" className="font-medium text-ink underline decoration-amber decoration-2 underline-offset-4">
            Why not just…
          </Link>
        </p>

        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-[14px]">
            <thead>
              <tr className="hairline border-b align-bottom">
                <th className="sticky left-0 z-10 w-[26%] bg-white pb-4 text-left font-normal text-ash">Model</th>
                {tierOrder.map((id) => {
                  const t = tiers[id];
                  return (
                    <th key={id} className="pb-4 text-left align-bottom">
                      <div
                        className="font-display text-[20px] font-medium tracking-[-0.01em] text-ink"
                      >
                        {t.name.replace("Woven ", "")}
                      </div>
                      <div className="mt-0.5 text-[13px] font-normal text-ash">
                        From {formatPrice(t.priceFrom)}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {compareRows.map((r) => (
                <tr key={r.key} className="hairline border-b">
                  <th className="sticky left-0 z-10 bg-white py-3.5 pr-3 text-left font-normal text-ash">{r.label}</th>
                  {tierOrder.map((id) => (
                    <td
                      key={id}
                      className={`py-3.5 pr-4 font-medium ${id === current ? "text-ink" : "text-ink/80"}`}
                    >
                      {compareValues[r.key][id]}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="sticky left-0 z-10 bg-white pt-6" />
                {tierOrder.map((id) => (
                  <td key={id} className="pt-6 pr-4">
                    <Link
                      href={`/order?tier=${id}`}
                      className={`btn min-w-0 w-full ${id === current ? "btn-primary" : "btn-secondary"}`}
                    >
                      Reserve
                    </Link>
                    <Link
                      href={`/${id}`}
                      className="mt-2 block text-center text-[13px] font-medium text-ash underline-offset-4 hover:underline"
                    >
                      Learn more
                    </Link>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
