export type AccountType = "bank" | "credit_card" | "cash" | "savings" | "fd" | "loan";
export type TxnKind = "expense" | "income" | "transfer" | "adjustment";

export interface Account {
  id: string;
  user_id?: string;
  name: string;
  type: AccountType;
  institution: string | null;
  opening_balance: number;
  opening_date: string;
  credit_limit: number | null;
  billing_day: number | null;
  due_day: number | null;
  interest_rate: number | null;
  maturity_date: string | null;
  archived: boolean;
  sort_order: number;
  balance?: number;
}

export interface Txn {
  id: string;
  date: string;
  amount: number;
  kind: TxnKind;
  from_account_id: string | null;
  to_account_id: string | null;
  note: string | null;
  recurring_item_id?: string | null;
  instalment_plan_id?: string | null;
  receivable_id?: string | null;
  created_at: string;
}

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  pay_from_account_id: string | null;
  due_day: number | null;
  active: boolean;
  end_month: string | null;
  sort_order: number;
}

export interface RecurringMark {
  id: string;
  recurring_item_id: string;
  month: string;
  transaction_id: string | null;
  paid_at: string;
}

export interface InstalmentPlan {
  id: string;
  name: string;
  card_account_id: string;
  total_price: number;
  months: number;
  monthly_amount: number;
  first_billing_month: string;
  interest_rate: number;
}

export type ReceivableStatus = "waiting" | "quoted" | "partly_paid" | "paid";

export interface Receivable {
  id: string;
  who: string;
  description: string | null;
  amount: number;
  status: ReceivableStatus;
  expected_date: string | null;
  created_at: string;
}

export interface Statement {
  id: string;
  user_id?: string;
  account_id: string;
  statement_date: string;
  period_start: string;
  period_end: string;
  statement_balance: number;
  due_date: string;
  source: "auto" | "edited";
}

export interface Reconciliation {
  id: string;
  account_id: string;
  date: string;
  actual_balance: number;
  computed_balance: number;
  adjustment_txn_id: string | null;
  created_at: string;
}

export const RECEIVABLE_STATUS_LABEL: Record<ReceivableStatus, string> = {
  waiting: "Waiting",
  quoted: "Quoted",
  partly_paid: "Partly paid",
  paid: "Paid",
};

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "bank", label: "Bank account" },
  { value: "credit_card", label: "Credit card" },
  { value: "cash", label: "Cash" },
  { value: "savings", label: "Savings" },
  { value: "fd", label: "Fixed deposit" },
  { value: "loan", label: "Loan (money I owe)" },
];

export const TYPE_GROUP_LABEL: Record<AccountType, string> = {
  bank: "Bank accounts",
  cash: "Cash",
  savings: "Savings",
  fd: "Fixed deposits",
  credit_card: "Credit cards",
  loan: "Loans",
};

export const isDebtType = (t: AccountType) => t === "credit_card" || t === "loan";
