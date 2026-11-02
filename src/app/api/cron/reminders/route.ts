import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAccounts } from "@/lib/data";
import { ensureStatements } from "@/lib/statements";
import { buildReminders, loadChecklist, loadReceivables } from "@/lib/reminders";
import { sendToSubscriptions } from "@/lib/push";
import { todayColombo } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Runs once a day (see vercel.json). Creates any new card statements and sends
 * a push for each reminder that is worth one today. Vercel calls it with
 * "Authorization: Bearer $CRON_SECRET".
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = todayColombo();
  const { data: subs, error } = await supabase.from("push_subscriptions").select("user_id,endpoint,p256dh,auth");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = [...new Set((subs ?? []).map((s) => s.user_id as string))];
  const report: Record<string, { reminders: number; sent: number }> = {};

  for (const uid of users) {
    const accounts = await loadAccounts(supabase, { uid });
    const [statements, checklist, receivables] = await Promise.all([
      ensureStatements(supabase, accounts, today, uid),
      loadChecklist(supabase, today.slice(0, 7), uid),
      loadReceivables(supabase, uid),
    ]);
    const due = buildReminders(today, statements, checklist, receivables).filter((r) => r.push);
    const mine = (subs ?? []).filter((s) => s.user_id === uid);

    let sent = 0;
    const gone = new Set<string>();
    for (const r of due) {
      const res = await sendToSubscriptions(mine, { title: r.title, body: r.body, url: r.href, tag: r.key });
      sent += res.sent;
      res.gone.forEach((g) => gone.add(g));
    }
    if (gone.size) await supabase.from("push_subscriptions").delete().in("endpoint", [...gone]);
    report[uid.slice(0, 8)] = { reminders: due.length, sent };
  }

  return NextResponse.json({ ok: true, today, report });
}
