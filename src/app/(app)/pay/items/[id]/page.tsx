import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAccounts } from "@/lib/data";
import { deleteRecurringItem } from "@/app/actions";
import { RecurringForm } from "@/components/Forms";
import type { RecurringItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const [{ data }, accounts] = await Promise.all([
    supabase.from("recurring_items").select("*").eq("id", id).maybeSingle(),
    getAccounts(),
  ]);
  if (!data) notFound();
  const item = { ...(data as RecurringItem), amount: Number(data.amount) };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Link href="/pay/items" className="text-sm text-muted">‹ Fixed payments</Link>
        <h1 className="text-xl font-semibold">{item.name}</h1>
        <RecurringForm initial={item} accounts={accounts.map(({ id, name }) => ({ id, name }))} />
      </div>
      <form action={deleteRecurringItem}>
        <input type="hidden" name="id" value={item.id} />
        <button className="btn btn-ghost w-full text-out">Delete fixed payment</button>
        <p className="mt-1.5 text-center text-xs text-muted">Past payments stay in your history. To stop it, untick Active instead.</p>
      </form>
    </div>
  );
}
