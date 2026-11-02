import Link from "next/link";
import { getAccounts } from "@/lib/data";
import { RecurringForm } from "@/components/Forms";

export const dynamic = "force-dynamic";

export default async function NewItemPage() {
  const accounts = await getAccounts();
  return (
    <div className="space-y-4">
      <Link href="/pay/items" className="inline-flex items-center gap-1 text-sm text-muted">‹ Fixed payments</Link>
      <h1 className="font-serif text-[1.75rem] leading-tight font-medium">New fixed payment</h1>
      <RecurringForm accounts={accounts.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
