"use client";
import { useActionState } from "react";
import { signIn } from "@/app/actions";

export default function LoginPage() {
  const [state, action, pending] = useActionState(signIn, undefined);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4">
      <h1 className="mb-1 text-2xl font-semibold">My Expenses</h1>
      <p className="mb-8 text-sm text-muted">Sign in to continue.</p>
      <form action={action} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required className="field" />
        </div>
        {state?.error && <p className="text-sm text-out">{state.error}</p>}
        <button className="btn w-full" disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button>
      </form>
    </main>
  );
}
