// Runs once a day (Vercel Cron, see vercel.json). It:
// 1. Keeps the free Supabase project awake (any query counts as activity).
// 2. Works out today's reminders and sends the push-worthy ones to every subscribed phone.
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { loadCards, loadRecurring } from "@/lib/finance";
import { buildReminders } from "@/lib/reminders";
import { sendPush } from "@/lib/push";
import { todayColombo } from "@/lib/format";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return Response.json({ ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" }, { status: 500 });

  const supabase = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, { auth: { persistSession: false } });
  const today = todayColombo();
  const [{ statuses }, recurring, subsRes] = await Promise.all([
    loadCards(supabase, today),
    loadRecurring(supabase),
    supabase.from("push_subscriptions").select("id, subscription"),
  ]);

  const reminders = buildReminders(statuses, recurring, today).filter((r) => r.push);
  const subs = subsRes.data ?? [];
  let sent = 0;
  for (const r of reminders) {
    for (const s of subs) {
      const res = await sendPush(s.subscription, { title: r.title, body: r.body, url: r.url, tag: r.key });
      if (res.ok) sent++;
      if (res.gone) await supabase.from("push_subscriptions").delete().eq("id", s.id);
    }
  }
  return Response.json({ ok: true, today, reminders: reminders.map((r) => r.title), subscriptions: subs.length, sent });
}
