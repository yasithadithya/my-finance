# My Expenses

A personal finance PWA for one user. It tracks bank accounts, credit cards, cash, savings, FDs and loans. Every balance is worked out from a ledger of transactions.

Stack: Next.js 15 (App Router, TypeScript, Tailwind) and Supabase (Postgres + Auth). Both run on free tiers, hosted on Vercel.

## Status

- **Phase 0 + 1 (done)**: login, accounts, quick add (expense / income / transfer), history by month and account, home dashboard, installable PWA.
- **Phase 2 (done)**: card statements on the billing day, due-date tracking, instalment billing, the **Pay** tab ("Pay this month" checklist with the D tick), reminder banners on Home.
- **Phase 3 (done)**: Debts page with a payoff planner, money owed to me, reconcile.
- **Phase 4 (done)**: push notifications (a daily reminder job).

The schema is in `supabase/migrations/0001_schema.sql`, plus `0002_push.sql` for push notifications.

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

### 5. Turn on push reminders (Phase 4)

1. In Supabase **SQL Editor**, run `supabase/migrations/0002_push.sql`.
2. Make push keys: `npx web-push generate-vapid-keys`.
3. Add these to `.env.local` **and** to Vercel → Project → Settings → Environment Variables (see `.env.example`):
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`: the two keys from step 2.
   - `VAPID_SUBJECT`: `mailto:` plus your email.
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API → `service_role`. Keep it secret; only the daily job uses it.
   - `CRON_SECRET`: any long random string.
4. Redeploy. `vercel.json` runs `/api/cron/reminders` every day at 02:30 UTC (8:00 am in Sri Lanka).
5. On your phone, open the installed app → **Accounts → Reminders on this phone → Turn on**, then tap **Send a test notification**.

## Using it

- **Pay tab**: everything to pay this month. Card bills appear on their statement day. Tap **D** to tick a fixed payment. If the payment has a "usually paid with" account, one tap records the expense. If not, pick the account first (or "Just tick"). Tap the filled **D** to undo.
- **Card statements**: amount = what you owed at the end of the statement day, minus instalments the bank holds but hasn't billed yet. Money paid into the card after the statement day counts toward that bill. To correct an amount, use **Correct amount** on the card page. **Reset to auto** goes back to the worked-out figure.
- **The October bill**: the app starts on 2 Nov, so it can't work out the 15 Oct statement (due 5 Nov). On each card page, tap **+ Add past statement** and enter what's still due.
- **Reconcile**: on any account, enter what your bank shows (for cards, the available credit). Any difference is booked as an adjustment.
- **Debts**: set an interest rate on each card or loan (Edit account), then enter a monthly budget in the payoff planner.
- **Owed to me**: tap an item → **Record money received**. Partly paid and paid are set for you.

## How the money works

- Amounts are always positive. The From and To accounts decide the direction.
  - Expense: From = the account you paid with.
  - Income: To = the account the money went into.
  - Transfer: both. For example, a card payment is From Com Bank, To BOC CC.
- A credit card or loan balance below zero is money you owe.
- Transfers are never counted as spending. Transfers into a card or loan show up as **Debt payments**.
- The bank already holds the full remaining instalment amount against your card. So the Galaxy Buds plan never adds debt; it only tells the statement how much is billed each cycle.

## Project layout

```
src/app/(app)/             Home, Pay, Add, History, Accounts, Debts, Owed (behind login)
src/app/api/cron/          Daily reminder job (push notifications)
src/app/login/             Sign-in page
src/app/actions.ts         All server actions (create/update/delete)
src/app/manifest.ts        PWA manifest
src/components/            Forms, TxnRow, Reminders, PushToggle, BottomNav
src/lib/statements.ts      Statement generation, instalment billing, payments per bill
src/lib/reminders.ts       Checklist, receivables and reminder rules (banners + push)
src/lib/payoff.ts          Debt payoff simulation
src/lib/                   Supabase clients, data helpers, formatting, types
src/middleware.ts          Session refresh + redirect to /login
public/sw.js               Service worker (installable + push)
supabase/                  Schema migrations + day-one seed
vercel.json                Cron schedule
```
