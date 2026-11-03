const nf = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Rs 12,345.67" — negative numbers get a leading minus. */
export function lkr(n: number | string | null | undefined): string {
  const v = Number(n ?? 0);
  return (v < 0 ? "−Rs " : "Rs ") + nf.format(Math.abs(v));
}

export const num = (n: number | string | null | undefined) => Number(n ?? 0);

/** Today's date in Sri Lanka as YYYY-MM-DD (servers run in UTC). */
export function todayColombo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Colombo" }).format(new Date());
}

// ------------------------------------------------------------------ pay cycles
// A "month" in this app is a pay cycle that starts on salary day (the 30th) and is
// named after the month it ends in: "November 2026" = 30 Oct – 29 Nov.
// In months shorter than 30 days (February) the cycle starts on the last day.
export const CYCLE_START_DAY = 30;

const pad = (n: number) => String(n).padStart(2, "0");
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The date salary day falls on in calendar month y-m. */
function cycleStartIn(y: number, m: number): string {
  return `${y}-${pad(m)}-${pad(Math.min(CYCLE_START_DAY, lastDay(y, m)))}`;
}

/** Which cycle ("YYYY-MM") a date belongs to. */
export function cycleOf(date: string): string {
  const y = Number(date.slice(0, 4)), m = Number(date.slice(5, 7));
  return date >= cycleStartIn(y, m) ? shiftMonth(`${y}-${pad(m)}`, 1) : `${y}-${pad(m)}`;
}

/** The cycle today is in. */
export const currentMonth = () => cycleOf(todayColombo());

/** Start (inclusive) and end (exclusive) dates of cycle "YYYY-MM". */
export function monthRange(ym: string): { start: string; end: string } {
  const [y, m] = ym.split("-").map(Number);
  const [py, pm] = shiftMonth(ym, -1).split("-").map(Number);
  return { start: cycleStartIn(py, pm), end: cycleStartIn(y, m) };
}

/** "30 Oct – 29 Nov" */
export function cycleSpan(ym: string): string {
  const { start, end } = monthRange(ym);
  const last = new Date(end + "T00:00:00Z");
  last.setUTCDate(last.getUTCDate() - 1);
  const f = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  return `${f(new Date(start + "T00:00:00Z"))} – ${f(last)}`;
}

const dayDiff = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 86400000);

/** Days of the cycle that have started so far (today counts). */
export function daysIntoCycle(ym: string): number {
  const { start, end } = monthRange(ym);
  const today = todayColombo();
  if (today < start) return 0;
  if (today >= end) return dayDiff(start, end);
  return dayDiff(start, today) + 1;
}

export function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function dayLabel(date: string): string {
  const today = todayColombo();
  if (date === today) return "Today";
  const d = new Date(date + "T00:00:00Z");
  const y = new Date(today + "T00:00:00Z");
  y.setUTCDate(y.getUTCDate() - 1);
  if (d.getTime() === y.getTime()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

/** "14:32" in Sri Lanka time for a timestamp. */
export function timeColombo(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Colombo", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

/** Days left in the cycle including today; 0 for past cycles. */
export function daysLeftInMonth(ym: string): number {
  const { start, end } = monthRange(ym);
  const today = todayColombo();
  if (today >= end) return 0;
  return dayDiff(today < start ? start : today, end);
}

/** "Com Bank" → "CB", "Cash" → "CA". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return (parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)).toUpperCase();
}
