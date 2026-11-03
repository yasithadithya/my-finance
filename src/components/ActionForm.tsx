"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions";

/** A form bound to a server action that returns { error } or redirects. */
export default function ActionForm({
  action,
  children,
  submit,
  className = "space-y-3",
  ghost,
}: {
  action: (state: FormState, fd: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submit: string;
  className?: string;
  ghost?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className={className}>
      {children}
      {state?.error && <p className="rounded-lg bg-out/10 px-3 py-2 text-sm text-out">{state.error}</p>}
      <button className={`btn w-full ${ghost ? "btn-ghost" : ""}`} disabled={pending}>
        {pending ? "Saving…" : submit}
      </button>
    </form>
  );
}
