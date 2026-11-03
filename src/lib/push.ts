import webpush, { type PushSubscription } from "web-push";

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:me@example.com", pub, priv);
  configured = true;
  return true;
}

export async function sendPush(
  subscription: PushSubscription,
  payload: { title: string; body: string; url?: string; tag?: string },
): Promise<{ ok: boolean; gone?: boolean; error?: string }> {
  if (!configure()) return { ok: false, error: "VAPID keys are not set" };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), { TTL: 60 * 60 * 12 });
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return { ok: false, gone: status === 404 || status === 410, error: (e as Error).message };
  }
}
