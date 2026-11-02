import Link from "next/link";

const Chevron = ({ d }: { d: string }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

/** Month title with quiet previous / next buttons on either side. */
export default function MonthNav({ label, prev, next }: { label: string; prev: string; next: string }) {
  return (
    <div className="flex items-center justify-between">
      <Link href={prev} className="btn-icon" aria-label="Previous month"><Chevron d="m15 6-6 6 6 6" /></Link>
      <h1 className="font-serif text-2xl font-medium">{label}</h1>
      <Link href={next} className="btn-icon" aria-label="Next month"><Chevron d="m9 6 6 6-6 6" /></Link>
    </div>
  );
}
