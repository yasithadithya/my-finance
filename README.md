# My Expenses

A personal finance PWA for one user. It tracks bank accounts, credit cards, cash, savings, FDs and loans. Every balance is worked out from a ledger of transactions.

Stack: Next.js 15 (App Router, TypeScript, Tailwind) and Supabase (Postgres + Auth). Both run on free tiers, hosted on Vercel.

## Status: all phases built

- **Phase 1**: login, accounts, quick add (expense / income / transfer), history by pay cycle with search, home dashboard, installable PWA.
- **Phase 2**: card statements (closing on the 15th, due on the 5th), worked out from the ledger. Also: instalment plans, the **Pay** checklist with the D tick, and reminder banners on Home.
- **Phase 3**: debts and payoff plan, money owed to me (with part payments), and reconciling against your bank.
- **Phase 4**: push notifications through a daily Vercel cron (which also keeps Supabase awake), CSV export, and weekly GitHub backups.

**Database scripts, run in order in the Supabase SQL Editor:** `0001_schema.sql` → `seed.sql` → `0002_pay_cycle.sql` → `0003_phases_2_4.sql`.

## Setup (about 15 minutes)

### 1. Supabase

1. Create a project at supabase.com. Pick the free plan and the Singapore region (closest to Sri Lanka).
2. Go to **SQL Editor**, paste in all of `supabase/migrations/0001_schema.sql`, and click **Run**.
3. Go to **Authentication → Users → Add user → Create new user**. Use your email and a strong password, and tick "Auto confirm".
4. Go to **Authentication → Sign In / Providers** and turn **off** "Allow new users to sign up". This stops anyone else from creating an account.
5. Back in **SQL Editor**, run `supabase/seed.sql`. It creates your accounts, cards, fixed payments, the Buds instalment plan and your receivables.
6. Go to **Project Settings → API** and copy the Project URL and the anon (publishable) key.

### 2. Run locally

```bash
cp .env.example .env.local   # paste in the URL and key
npm install
npm run dev                  # http://localhost:3000
```

### 3. Set your real opening balances

The seed sets the cards from your available credit on 2 Nov (BOC owes 7,737.34, Com owes 35,394.56). The bank accounts and cash start at **0**. Before you add any transactions, open **Accounts → each bank / Cash → Edit account** and enter the real balance as of 2 Nov.

### 4. Deploy and install on your phone

1. Push the project to a **private** GitHub repo.
2. In Vercel, click **Add New → Project**, import the repo, and add the two `NEXT_PUBLIC_SUPABASE_*` variables.
3. On your S25 Ultra, open the Vercel URL in Chrome, then tap **⋮ → Add to home screen → Install**.

### 5. Turn on reminders, export and backups (Phase 4)

1. **Push keys.** On your laptop, run `npx web-push generate-vapid-keys`. It prints a public and a private key.
2. **Vercel env vars** (Settings → Environment Variables), then redeploy:
    - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` = the public key
    - `VAPID_PRIVATE_KEY` = the private key
    - `VAPID_SUBJECT` = `mailto:` followed by your email
    - `SUPABASE_SERVICE_ROLE_KEY` = from Supabase → Project Settings → API. Keep it secret, and never add the `NEXT_PUBLIC_` prefix to it.
    - `CRON_SECRET` = any long random string
3. **On your phone:** open the installed app, go to **More → Payment reminders → Turn on**, then tap **Test**.
4. **What the daily job does.** `vercel.json` runs it every day at about 8:00 am Sri Lanka time. Each day it:
    - pings the database, so the free Supabase project never pauses
    - sends push reminders: the statement closing on the 15th/16th, the five days before the 5th, overdue payments, and unticked fixed payments near payday
5. **Backups.** In your GitHub repo, add the secret `SUPABASE_DB_URL` (Supabase → Project Settings → Database → Session pooler connection string, with your password filled in). `.github/workflows/backup.yml` then saves a dump every week and keeps 90 days. Run it once by hand from the Actions tab to check it works.
6. **Export.** **More → Export transactions** downloads a CSV of every transaction.

## Credit cards: how dues are worked out

- **What's due on the 5th** = what you owed when the statement closed on the 15th, minus the 0% instalments the bank is still holding, minus anything you've paid into the card since the 15th.
- **The 15 Oct statement closed before you started tracking.** The Cards screen asks you to type that amount once. After that, every statement is calculated automatically.
- **If the bank's figure differs** (interest or fees), use "Statement amount different?" on the Cards screen to override it.

## Pay cycles (the app's "month")

Every month in the app is a **pay cycle** that starts on salary day, the 30th. Each cycle is named after the month it ends in, so "November 2026" runs from 30 Oct to 29 Nov. In February the cycle starts on the last day of the month (28th or 29th).

- If salary arrives early (say on the 28th, because the 30th is a holiday), set that transaction's date to the 30th so it counts in the new cycle.
- The start day is `CYCLE_START_DAY` in `src/lib/format.ts`.
- Choosing Income on the Add screen fills in Com Bank as the account automatically.
- If you already ran `0001_schema.sql`, also run `supabase/migrations/0002_pay_cycle.sql`. It removes the old calendar-month view.

## How the money works

- Amounts are always positive. The From and To accounts decide the direction.
  - Expense: From = the account you paid with.
  - Income: To = the account the money went into.
  - Transfer: both. For example, a card payment is From Com Bank, To BOC CC.
- A credit card or loan balance below zero is money you owe.
- Transfers are never counted as spending. Transfers into a card or loan show up as **Debt payments**.
- The bank already holds the full remaining instalment amount against your card. So the Galaxy Buds plan never adds debt; in Phase 2 it only tells the statement how much is billed each cycle.

## Project layout

```
src/app/(app)/         Home, Add, Transactions, Accounts (behind login)
src/app/login/         Sign-in page
src/app/actions.ts     All server actions (create/update/delete)
src/app/manifest.ts    PWA manifest
src/components/        TxnForm, AccountForm, TxnRow, BottomNav
src/lib/               Supabase client, data helpers, formatting, types
src/middleware.ts      Session refresh + redirect to /login
public/sw.js           Service worker (installable; push comes in Phase 4)
supabase/              Schema migration + day-one seed
```
