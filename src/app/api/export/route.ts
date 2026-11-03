import { createClient } from "@/lib/supabase/server";
import { todayColombo } from "@/lib/format";

export const dynamic = "force-dynamic";

const esc = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Unauthorized", { status: 401 });

  const [{ data: accounts }, { data: txns }] = await Promise.all([
    supabase.from("accounts").select("id, name"),
    supabase.from("transactions").select("*").order("date").order("created_at"),
  ]);
  const name = new Map((accounts ?? []).map((a) => [a.id, a.name]));
  const rows = [
    ["date", "kind", "amount_lkr", "from_account", "to_account", "note", "created_at"],
    ...(txns ?? []).map((t) => [
      t.date, t.kind, Number(t.amount).toFixed(2),
      t.from_account_id ? name.get(t.from_account_id) : "", t.to_account_id ? name.get(t.to_account_id) : "",
      t.note, t.created_at,
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-expenses-${todayColombo()}.csv"`,
    },
  });
}
