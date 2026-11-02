import Amount from "@/components/Amount";
import Link from "next/link";
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
    <div className="space-y-5">
      <header>
        <Link href="/" className="inline-flex items-center gap-1 text-sm text-muted">‹ Home</Link>
        <div className="mt-1 flex items-center justify-between">
          <h1 className="font-serif text-[1.75rem] leading-tight font-medium">Owed to me</h1>
          <Link href="/owed/new" className="btn px-3 py-2 text-sm">+ New</Link>
        </div>
        <p className="mt-2 text-[2.25rem] font-medium text-in"><Amount value={confirmed} /></p>
        {quoted > 0 && <p className="num text-xs text-muted">+ {lkr(quoted)} quoted, not confirmed</p>}
      </header>

      {open.length === 0 ? (
        <p className="text-sm text-muted">Nobody owes you anything right now.</p>
      ) : (
        <ul className="ledger">
          {open.map((r) => {
            const late = r.expected_date && r.expected_date < today;
            return (
              <li key={r.id}>
                <Link href={`/owed/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="block truncate">{r.who}</span>
                    <span className="block truncate text-xs text-muted">
                      {RECEIVABLE_STATUS_LABEL[r.shown_status]}
                      {r.description ? ` · ${r.description}` : ""}
                      {r.expected_date && <span className={late ? "text-out" : ""}> · by {shortDate(r.expected_date)}</span>}
                    </span>
                  </span>
                  <span className={`num shrink-0 ${r.shown_status === "quoted" ? "text-muted" : "text-in"}`}>{lkr(r.outstanding)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {done.length > 0 && (
        <section>
          <h2 className="mb-2 px-1 text-sm font-medium text-muted">Paid</h2>
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
