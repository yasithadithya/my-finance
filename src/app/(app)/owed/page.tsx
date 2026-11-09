import Amount from "@/components/Amount";
import Link from "next/link";
import PageHeader, { AddAction } from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { loadReceivables } from "@/lib/reminders";
import { lkr, shortDate, todayColombo } from "@/lib/format";
import { RECEIVABLE_STATUS_LABEL } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function OwedPage() {
  const supabase = await createClient();
  const all = await loadReceivables(supabase);
  const today = todayColombo();
  const open = all.filter((r) => r.outstanding > 0);
  const done = all.filter((r) => r.outstanding <= 0);
  const confirmed = open.filter((r) => r.shown_status !== "quoted").reduce((s, r) => s + r.outstanding, 0);
  const quoted = open.filter((r) => r.shown_status === "quoted").reduce((s, r) => s + r.outstanding, 0);

  return (
    <div className="page-in space-y-6">
      <PageHeader title="Owed to me" back={{ href: "/", label: "Home" }} action={<AddAction href="/owed/new" label="Someone owes me" />}>
        <p className="mt-2 text-[2.5rem] text-in"><Amount value={confirmed} /></p>
        {quoted > 0 && <p className="num mt-1 text-[0.8125rem] text-muted">+ {lkr(quoted)} quoted, not confirmed</p>}
      </PageHeader>

      {open.length === 0 ? (
        <p className="card p-5 text-[0.9375rem] text-muted">Nobody owes you anything right now.</p>
      ) : (
        <ul className="ledger">
          {open.map((r) => {
            const late = r.expected_date && r.expected_date < today;
            return (
              <li key={r.id}>
                <Link href={`/owed/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate text-[0.9375rem] font-medium">{r.who}</span>
                    <span className="block truncate text-[0.8125rem] text-muted">
                      {RECEIVABLE_STATUS_LABEL[r.shown_status]}
                      {r.description ? ` · ${r.description}` : ""}
                      {r.expected_date && <span className={late ? "text-out" : ""}> · by {shortDate(r.expected_date)}</span>}
                    </span>
                  </span>
                  <span className={`num shrink-0 text-[0.9375rem] font-semibold ${r.shown_status === "quoted" ? "text-muted" : "text-in"}`}>{lkr(r.outstanding)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <section>
          <div className="section-head"><h2>Paid</h2></div>
          <ul className="ledger text-muted">
            {done.map((r) => (
              <li key={r.id}>
                <Link href={`/owed/${r.id}`} className="flex justify-between px-4 py-3">
                  <span className="truncate">{r.who}{r.description ? ` · ${r.description}` : ""}</span>
                  <span className="num">{lkr(r.amount)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
