// Server only (uses the VAPID private key).
import webpush from "web-push";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushMessage {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

type Row = { endpoint: string; p256dh: string; auth: string };

let configured = false;
function configure() {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) throw new Error("Push isn't set up: add NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.");
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:me@example.com", pub, priv);
  configured = true;
}

/**
 * Sends one message to every subscription. Returns how many went out and the
 * endpoints the push service says are gone (to delete).
 */
export async function sendToSubscriptions(rows: Row[], msg: PushMessage): Promise<{ sent: number; gone: string[] }> {
  configure();
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify(msg),
          { TTL: 60 * 60 * 12, urgency: "normal" },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(r.endpoint);
        else throw e;
      }
    }),
  );
  return { sent, gone };
}
