"use client";

import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

type State = "loading" | "unsupported" | "off" | "on" | "blocked";

export default function PushToggle() {
  const [state, setState] = useState<State>("loading");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !KEY) return setState("unsupported");
      if (Notification.permission === "denied") return setState("blocked");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "blocked" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(KEY) }));
      const res = await savePushSubscription(sub.toJSON() as Parameters<typeof savePushSubscription>[0]);
      if (res.error) throw new Error(res.error);
      setState("on");
      setMsg("Reminders are on for this device.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Couldn't turn on reminders.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    const res = await sendTestPush();
    setMsg(res.error ?? `Sent to ${res.sent} device${res.sent === 1 ? "" : "s"}.`);
    setBusy(false);
  }

  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <span>
          <span className="block font-medium">Reminders on this phone</span>
          <span className="block text-xs text-muted">
            {state === "on" && "On. Every morning around 8:00 for bills and payments due."}
            {state === "off" && "Get a notification when a bill is due."}
            {state === "blocked" && "Blocked. Allow notifications for this app in Chrome's site settings."}
            {state === "unsupported" && (KEY ? "Install the app to your home screen first." : "Push keys aren't set up yet (see README).")}
            {state === "loading" && "Checking…"}
          </span>
        </span>
        {state === "off" && <button className="btn shrink-0 px-3 py-2 text-sm" onClick={turnOn} disabled={busy}>Turn on</button>}
        {state === "on" && <button className="btn btn-ghost shrink-0 px-3 py-2 text-sm" onClick={turnOff} disabled={busy}>Turn off</button>}
      </div>
      {state === "on" && (
        <button className="mt-3 text-sm text-accent" onClick={test} disabled={busy}>Send a test notification</button>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </div>
  );
}
