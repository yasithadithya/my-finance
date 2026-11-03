import Link from "next/link";
import { ArrowLeftRight, Banknote, CreditCard, HandCoins, Landmark, LogOut, PiggyBank, Plus, ShieldCheck, Vault } from "lucide-react";
import { getAccounts } from "@/lib/data";
import { initials, lkr } from "@/lib/format";
import { TYPE_GROUP_LABEL, isDebtType, type Account, type AccountType } from "@/lib/types";
import { signOut } from "@/app/actions";

export const dynamic = "force-dynamic";

const ORDER: AccountType[] = ["bank", "cash", "savings", "fd", "credit_card", "loan"];
const GROUP_ICON = { bank: Landmark, cash: Banknote, savings: PiggyBank, fd: Vault, credit_card: CreditCard, loan: HandCoins };

export default async function AccountsPage() {
  const accounts = await getAccounts({ includeArchived: true });
  const active = accounts.filter((a) => !a.archived);
  const archived = accounts.filter((a) => a.archived);
  const assets = active.filter((a) => !isDebtType(a.type)).reduce((t, a) => t + a.balance!, 0);
  const owed = active.filter((a) => isDebtType(a.type)).reduce((t, a) => t + Math.min(a.balance!, 0), 0);
  const cards = active.filter((a) => a.type === "credit_card");

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Portfolio</p>
          <h1 className="text-xl font-semibold">Accounts</h1>
        </div>
        <Link href="/accounts/new" className="btn px-3.5 py-2 text-sm"><Plus size={16} /> New</Link>
      </header>

      <section className="hero p-5">
        <p className="eyebrow">Net position</p>
        <p className={`num mt-1 text-[2rem] font-semibold leading-tight ${assets + owed < 0 ? "text-out" : "text-accent"}`}>{lkr(assets + owed)}</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
            <p className="eyebrow flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-in" /> Assets</p>
            <p className="num mt-0.5 font-semibold">{lkr(assets)}</p>
          </div>
          <div className="rounded-xl bg-surface-2/80 px-3 py-2.5">
            <p className="eyebrow flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-out" /> Owed</p>
            <p className="num mt-0.5 font-semibold">{lkr(-owed)}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2.5">
        <Link href="/add?kind=transfer" className="btn btn-ghost text-sm"><ArrowLeftRight size={16} className="text-accent" /> Transfer</Link>
        <Link href={cards[0] ? `/add?kind=transfer&to=${cards[0].id}` : "/add?kind=transfer"} className="btn btn-ghost text-sm">
          <CreditCard size={16} className="text-accent" /> Pay a card
        </Link>
      </div>

      {ORDER.map((type) => {
        const list = active.filter((a) => a.type === type);
        if (!list.length) return null;
        const total = list.reduce((t, a) => t + a.balance!, 0);
        const Icon = GROUP_ICON[type];
        const allClear = type === "loan" && list.every((a) => a.balance === 0);
        return (
          <section key={type}>
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <h2 className="flex items-center gap-2 font-semibold"><Icon size={16} className="text-accent" /> {TYPE_GROUP_LABEL[type]}</h2>
              <span className="num text-xs text-muted">{lkr(total)}</span>
            </div>
            {allClear ? (
              <div className="card flex items-center gap-3 p-4">
                <span className="icon-tile text-in"><ShieldCheck size={17} /></span>
                <div>
                  <p className="font-medium">Debt-free zone</p>
                  <p className="text-xs text-muted">No money owed on {list.map((a) => a.name).join(", ")}.</p>
                </div>
              </div>
            ) : (
              <ul className="card divide-y divide-line overflow-hidden">
                {list.map((a) => <AccountRow key={a.id} a={a} />)}
              </ul>
            )}
          </section>
        );
      })}

      {archived.length > 0 && (
        <section>
          <h2 className="mb-2.5 px-0.5 font-semibold text-muted">Archived</h2>
          <ul className="card divide-y divide-line overflow-hidden opacity-70">
            {archived.map((a) => <AccountRow key={a.id} a={a} />)}
          </ul>
        </section>
      )}

      <form action={signOut}>
        <button className="btn btn-ghost w-full text-sm text-muted"><LogOut size={15} /> Sign out</button>
      </form>
    </div>
  );
}

function AccountRow({ a }: { a: Account }) {
  const isCard = a.type === "credit_card";
  const owed = Math.max(-a.balance!, 0);
  const pct = isCard && a.credit_limit ? Math.min(100, Math.round((owed / a.credit_limit) * 100)) : null;
  const bar = pct === null ? "" : pct >= 80 ? "bg-out" : pct >= 50 ? "bg-warn" : "bg-accent";
  return (
    <li>
      <Link href={`/accounts/${a.id}`} className="flex items-center gap-3 px-3.5 py-3 active:bg-surface-2">
        <span className="icon-tile num text-xs font-semibold text-accent">{initials(a.name)}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">{a.name}</span>
          {pct !== null ? (
            <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-surface-3">
              <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
            </span>
          ) : (
            <span className="block truncate text-xs text-faint">{a.institution ?? TYPE_GROUP_LABEL[a.type]}</span>
          )}
        </span>
        <span className="shrink-0 text-right">
          {isCard ? (
            <>
              <span className="num block font-semibold text-out">Owes {lkr(owed)}</span>
              {pct !== null && <span className="num block text-[11px] text-faint">{pct}% · {lkr(a.credit_limit! - owed)} free</span>}
            </>
          ) : (
            <span className={`num block font-semibold ${a.balance! < 0 ? "text-out" : ""}`}>{lkr(a.balance)}</span>
          )}
        </span>
      </Link>
    </li>
  );
}
