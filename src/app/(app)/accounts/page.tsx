import Link from "next/link";
import { getAccounts } from "@/lib/data";
import { lkr } from "@/lib/format";
import { TYPE_GROUP_LABEL, type AccountType } from "@/lib/types";
import { signOut } from "@/app/actions";
import PushToggle from "@/components/PushToggle";
import PageHeader, { AddAction } from "@/components/PageHeader";
import { Icon, ICONS, RowChevron } from "@/components/Icons";

export const dynamic = "force-dynamic";

const ORDER: AccountType[] = ["bank", "cash", "savings", "fd", "credit_card", "loan"];

/** Icon and tint for each kind of account. */
const TYPE_LOOK: Record<AccountType, { icon: string; cls: string }> = {
  bank: { icon: ICONS.bank, cls: "bg-accent/14 text-accent" },
  cash: { icon: ICONS.cash, cls: "bg-in/14 text-in" },
  savings: { icon: ICONS.piggy, cls: "bg-[#9b6bff]/16 text-[#9b6bff]" },
  fd: { icon: ICONS.lock, cls: "bg-warn/16 text-warn" },
  credit_card: { icon: ICONS.card, cls: "bg-[#ff7a45]/16 text-[#ff7a45]" },
  loan: { icon: ICONS.loan, cls: "bg-out/14 text-out" },
};

const MORE = [
  { href: "/debts", label: "Debts and payoff plan", icon: ICONS.trend, cls: "bg-out/14 text-out" },
  { href: "/owed", label: "Money owed to me", icon: ICONS.people, cls: "bg-in/14 text-in" },
  { href: "/pay/items", label: "Fixed payments", icon: ICONS.repeat, cls: "bg-accent/14 text-accent" },
];

export default async function AccountsPage() {
  const accounts = await getAccounts({ includeArchived: true });
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);

  return (
    <div className="page-in space-y-6">
      <PageHeader title="Accounts" action={<AddAction href="/accounts/new" label="New account" />} />

      {ORDER.map((type) => {
        const list = active.filter((a) => a.type === type);
        if (!list.length) return null;
        const total = list.reduce((t, a) => t + a.balance!, 0);
        const look = TYPE_LOOK[type];
        return (
          <section key={type}>
            <div className="section-head">
              <h2>{TYPE_GROUP_LABEL[type]}</h2>
              <span className={`aside quiet num ${total < 0 ? "text-out" : ""}`}>{lkr(total)}</span>
            </div>
            <ul className="ledger">
              {list.map((a) => (
                <li key={a.id}>
                  <Link href={`/accounts/${a.id}`} className="flex items-center gap-3.5 px-4 py-3">
                    <span className={`avatar ${look.cls}`} aria-hidden>
                      <Icon d={look.icon} size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[0.9375rem] font-medium">{a.name}</span>
                      {a.institution && <span className="block truncate text-[0.8125rem] text-muted">{a.institution}</span>}
                    </span>
                    <span className={`num shrink-0 text-[0.9375rem] font-semibold ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {archived.length > 0 && (
        <section>
          <div className="section-head"><h2>Archived</h2></div>
          <ul className="ledger text-muted">
            {archived.map((a) => (
              <li key={a.id}>
                <Link href={`/accounts/${a.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-[0.9375rem]">{a.name}</span>
                  <span className="num text-[0.9375rem]">{lkr(a.balance)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="section-head"><h2>More</h2></div>
        <ul className="ledger">
          {MORE.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="flex items-center gap-3.5 px-4 py-3">
                <span className={`avatar ${l.cls}`} aria-hidden>
                  <Icon d={l.icon} size={19} />
                </span>
                <span className="flex-1 text-[0.9375rem] font-medium">{l.label}</span>
                <RowChevron />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="section-head"><h2>Notifications</h2></div>
        <PushToggle />
      </section>

      <form action={signOut} className="ledger">
        <button className="flex w-full items-center gap-3.5 px-4 py-3 text-left text-out active:bg-surface-2">
          <span className="avatar bg-out/14" aria-hidden>
            <Icon d={ICONS.logout} size={19} />
          </span>
          <span className="text-[0.9375rem] font-medium">Sign out</span>
        </button>
      </form>
    </div>
  );
}
