"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <main className="page-in mx-auto flex min-h-dvh max-w-sm flex-col px-5" style={{ paddingTop: "env(safe-area-inset-top)" }}>
      {/* Viewing area */}
      <div className="flex flex-1 flex-col justify-end pb-10">
        <div className="coins coins-still mb-6" aria-hidden>
          <span className="coin-shadow" />
          <span className="coin coin-1" />
          <span className="coin coin-2" />
          <span className="coin coin-3" />
        </div>
        <h1 className="large-title text-[2.5rem]">My Expenses</h1>
        <p className="mt-2 text-[0.9375rem] text-muted">Sign in to see your accounts and what&apos;s due.</p>
      </div>
      {/* Interaction area */}
      <form action={action} className="space-y-4 pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div className="card space-y-4 p-4">
          <div>
            <label className="label" htmlFor="email">Email</label>
            <input id="email" name="email" type="email" autoComplete="email" required className="field" />
          </div>
          <div>
            <label className="label" htmlFor="password">Password</label>
            <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
          </div>
        </div>
        {state?.error && <p className="px-1 text-sm text-out">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
