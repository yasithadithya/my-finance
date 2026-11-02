import Link from "next/link";
import { getAccounts } from "@/lib/data";
import { lkr } from "@/lib/format";
import { TYPE_GROUP_LABEL, type AccountType } from "@/lib/types";
import { signOut } from "@/app/actions";
import PushToggle from "@/components/PushToggle";

export const dynamic = "force-dynamic";

const ORDER: AccountType[] = ["bank", "cash", "savings", "fd", "credit_card", "loan"];

export default async function AccountsPage() {
  const accounts = await getAccounts({ includeArchived: true });
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Accounts</h1>
        <Link href="/accounts/new" className="btn px-3 py-2 text-sm">+ New</Link>
      </div>

      {ORDER.map((type) => {
        const list = active.filter((a) => a.type === type);
        if (!list.length) return null;
        const total = list.reduce((t, a) => t + a.balance!, 0);
        return (
          <section key={type}>
            <div className="mb-2 flex justify-between text-sm text-muted">
              <h2 className="font-medium">{TYPE_GROUP_LABEL[type]}</h2>
              <span className="num">{lkr(total)}</span>
            </div>
            <ul className="card divide-y divide-line">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/accounts/${a.id}`} className="flex items-center justify-between px-4 py-3">
                    <span>
                      {a.name}
                      {a.institution && <span className="ml-2 text-xs text-muted">{a.institution}</span>}
                    </span>
                    <span className={`num ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-muted">Archived</h2>
          <ul className="card divide-y divide-line text-muted">
            {archived.map((a) => (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`} className="flex justify-between px-4 py-3">
                  <span>{a.name}</span>
                  <span className="num">{lkr(a.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-2 text-sm font-medium text-muted">More</h2>
        <ul className="card divide-y divide-line">
          {[
            { href: "/debts", label: "Debts & payoff plan" },
            { href: "/owed", label: "Money owed to me" },
            { href: "/pay/items", label: "Fixed payments" },
          ].map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex justify-between px-4 py-3">
                <span>{l.label}</span>
                <span className="text-muted">›</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <PushToggle />

      <form action={signOut}>
        <button className="btn btn-ghost w-full text-sm">Sign out</button>
      </form>
    </div>
  );
}
