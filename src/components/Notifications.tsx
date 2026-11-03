"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions";

const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function toUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export default function Notifications() {
  const [state, setState] = useState<"loading" | "unsupported" | "nokey" | "denied" | "off" | "on">("loading");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      if (!KEY) return setState("nokey");
      if (Notification.permission === "denied") return setState("denied");
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);

  async function enable() {
    setMsg("");
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return setState("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toUint8(KEY!) });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    const res = await savePushSubscription(json);
    if (res.ok) setState("on");
    else setMsg(res.error ?? "Could not save");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await removePushSubscription(sub.endpoint);
      await sub.unsubscribe();
    }
    setState("off");
  }

  async function test() {
    setMsg("Sending…");
    const r = await sendTestPush();
    setMsg(r.sent ? "Sent. Check your notifications." : "Nothing sent. Check the VAPID keys on the server.");
  }

  const text = {
    loading: "Checking…",
    unsupported: "This browser can't receive push notifications. Install the app from Chrome first.",
    nokey: "Push keys aren't set up on the server yet (see README).",
    denied: "Notifications are blocked. Allow them in Chrome's site settings.",
    off: "Get reminders on the 16th, before the 5th, if a payment is late, and on payday.",
    on: "Reminders are on for this phone.",
  }[state];

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className={`icon-tile ${state === "on" ? "text-accent" : "text-faint"}`}>{state === "on" ? <Bell size={17} /> : <BellOff size={17} />}</span>
        <div className="flex-1">
          <p className="font-medium">Payment reminders</p>
          <p className="text-xs text-muted">{text}</p>
        </div>
      </div>
      {state === "off" && <button onClick={enable} className="btn mt-3 w-full text-sm">Turn on notifications</button>}
      {state === "on" && (
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <button onClick={test} className="btn btn-ghost text-sm"><Send size={14} /> Test</button>
          <button onClick={disable} className="btn btn-ghost text-sm text-muted">Turn off</button>
        </div>
      )}
      {msg && <p className="mt-2 text-xs text-muted">{msg}</p>}
    </section>
  );
}
