"use client";

import { useActionState, useState } from "react";
import { createAccount, updateAccount } from "@/app/actions";
import { ACCOUNT_TYPES, type Account, type AccountType } from "@/lib/types";

export default function AccountForm({ initial, today }: { initial?: Account; today: string }) {
  const editing = !!initial;
  const [state, action, pending] = useActionState(editing ? updateAccount : createAccount, undefined);
  const [type, setType] = useState<AccountType>(initial?.type ?? "bank");
  const isCard = type === "credit_card";

  return (
    <form action={action} className="space-y-4">
      {initial && <input type="hidden" name="id" value={initial.id} />}

      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={initial?.name} placeholder="e.g. Com Bank" className="field" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="type">Type</label>
          <select id="type" name="type" className="field" value={type} onChange={(e) => setType(e.target.value as AccountType)}>
            {ACCOUNT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="institution">Bank</label>
          <input id="institution" name="institution" defaultValue={initial?.institution ?? ""} className="field" />
        </div>
      </div>

      {isCard && (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="label" htmlFor="credit_limit">Limit</label>
            <input id="credit_limit" name="credit_limit" inputMode="decimal" defaultValue={initial?.credit_limit ?? ""} className="field num" />
          </div>
          <div>
            <label className="label" htmlFor="billing_day">Statement day</label>
            <input id="billing_day" name="billing_day" inputMode="numeric" defaultValue={initial?.billing_day ?? 15} className="field num" />
          </div>
          <div>
            <label className="label" htmlFor="due_day">Due day</label>
            <input id="due_day" name="due_day" inputMode="numeric" defaultValue={initial?.due_day ?? 5} className="field num" />
          </div>
        </div>
      )}

      {isCard && !editing && (
        <div>
          <label className="label" htmlFor="available_credit">Available credit now (from your bank app)</label>
          <input id="available_credit" name="available_credit" inputMode="decimal" className="field num" />
          <p className="hint mt-1.5">Fill this and the app works out what you owe (limit − available). Leave the opening balance blank.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="opening_balance">Opening balance</label>
          <input
            id="opening_balance"
            name="opening_balance"
            inputMode="decimal"
            defaultValue={initial ? initial.opening_balance : ""}
            placeholder="0.00"
            className="field num"
          />
        </div>
        <div>
          <label className="label" htmlFor="opening_date">As of</label>
          <input id="opening_date" name="opening_date" type="date" defaultValue={initial?.opening_date ?? today} className="field" />
        </div>
      </div>
      <p className="hint -mt-2">
        {isCard || type === "loan" ? "Money you owe is negative, e.g. −7737.34." : "What the account held on that date."}
      </p>

      {["fd", "credit_card", "loan", "savings"].includes(type) && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="interest_rate">Interest % p.a.</label>
            <input id="interest_rate" name="interest_rate" inputMode="decimal" defaultValue={initial?.interest_rate ?? ""} className="field num" />
          </div>
          {type === "fd" ? (
            <div>
              <label className="label" htmlFor="maturity_date">Matures</label>
              <input id="maturity_date" name="maturity_date" type="date" defaultValue={initial?.maturity_date ?? ""} className="field" />
            </div>
          ) : (
            <p className="self-end pb-3 text-xs text-muted">{isCard || type === "loan" ? "Used by the payoff planner." : ""}</p>
          )}
        </div>
      )}

      <div>
        <label className="label" htmlFor="sort_order">Order</label>
        <input id="sort_order" name="sort_order" inputMode="numeric" defaultValue={initial?.sort_order ?? 0} className="field num" />
      </div>
      {editing && (
        <label className="switch-row">
          <span>
            <span className="block text-[0.9375rem] font-medium">Archived</span>
            <span className="block text-[0.8125rem] text-muted">Move it to Archived and leave it out of totals</span>
          </span>
          <input type="checkbox" name="archived" defaultChecked={initial?.archived} className="switch" />
        </label>
      )}

      {state?.error && <p className="text-sm text-out">{state.error}</p>}
      <button className="btn w-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save account" : "Add account"}</button>
    </form>
  );
}
