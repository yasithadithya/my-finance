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

  const canToggle = state === "on" || state === "off";
  return (
    <div className="ledger">
      <div className="flex items-center gap-3.5 px-4 py-3.5">
        <span className="avatar bg-accent/14 text-accent" aria-hidden>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4" />
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[0.9375rem] font-medium">Reminders on this phone</span>
          <span className="block text-[0.8125rem] text-muted">
            {state === "on" && "Every morning around 8:00 for bills and payments due."}
            {state === "off" && "Get a notification when a bill is due."}
            {state === "blocked" && "Blocked. Allow notifications for this app in Chrome's site settings."}
            {state === "unsupported" && (KEY ? "Install the app to your home screen first." : "Push keys aren't set up yet (see README).")}
            {state === "loading" && "Checking…"}
          </span>
        </span>
        <input
          type="checkbox"
          role="switch"
          aria-label="Reminders on this phone"
          className="switch"
          checked={state === "on"}
          disabled={!canToggle || busy}
          onChange={() => (state === "on" ? turnOff() : turnOn())}
        />
      </div>
      {state === "on" && (
        <button className="block w-full px-4 py-3.5 text-left text-[0.9375rem] font-medium text-accent active:bg-surface-2" onClick={test} disabled={busy}>
          Send a test notification
        </button>
      )}
      {msg && <p className="px-4 py-3 text-xs text-muted">{msg}</p>}
    </div>
  );
}
