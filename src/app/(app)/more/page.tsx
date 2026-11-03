import Link from "next/link";
import { ChevronRight, CreditCard, Download, HandCoins, LogOut, ReceiptText, Repeat, Target, WalletCards } from "lucide-react";
import { signOut } from "@/app/actions";
import Notifications from "@/components/Notifications";

const links = [
  { href: "/accounts", label: "Accounts", sub: "Banks, cash, savings, FDs, loans", Icon: WalletCards },
  { href: "/cards", label: "Credit cards", sub: "Statements, dues, instalments", Icon: CreditCard },
  { href: "/debts", label: "Debts & payoff", sub: "What you owe and when it's cleared", Icon: Target },
  { href: "/receivables", label: "Money owed to me", sub: "Track and record payments in", Icon: HandCoins },
  { href: "/pay?manage=1", label: "Fixed payments", sub: "Subscriptions and monthly bills", Icon: Repeat },
];

export default function MorePage() {
  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Everything else</p>
        <h1 className="text-xl font-semibold">More</h1>
      </header>

      <ul className="card divide-y divide-line overflow-hidden">
        {links.map(({ href, label, sub, Icon }) => (
          <li key={href}>
            <Link href={href} className="flex items-center gap-3 px-3.5 py-3.5 active:bg-surface-2">
              <span className="icon-tile text-accent"><Icon size={17} /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-medium">{label}</span>
                <span className="block truncate text-xs text-faint">{sub}</span>
              </span>
              <ChevronRight size={16} className="text-faint" />
            </Link>
          </li>
        ))}
      </ul>

      <Notifications />

      <section className="card divide-y divide-line overflow-hidden">
        <a href="/api/export" className="flex items-center gap-3 px-3.5 py-3.5">
          <span className="icon-tile text-accent"><Download size={17} /></span>
          <span className="flex-1">
            <span className="block font-medium">Export transactions</span>
            <span className="block text-xs text-faint">CSV file of every transaction</span>
          </span>
        </a>
        <div className="flex items-center gap-3 px-3.5 py-3.5">
          <span className="icon-tile text-accent"><ReceiptText size={17} /></span>
          <span className="flex-1">
            <span className="block font-medium">Backups</span>
            <span className="block text-xs text-faint">Weekly database copy by GitHub Actions (see README)</span>
          </span>
        </div>
      </section>

      <form action={signOut}>
        <button className="btn btn-ghost w-full text-sm text-muted"><LogOut size={15} /> Sign out</button>
      </form>
    </div>
  );
}
