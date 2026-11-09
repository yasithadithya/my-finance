import Link from "next/link";
import { Icon, ICONS } from "@/components/Icons";

/** Month switcher: a pill with previous / next on either side. */
export default function MonthNav({ label, prev, next }: { label: string; prev: string; next: string }) {
  return (
    <div className="mt-4 flex items-center justify-between rounded-full bg-surface p-1">
      <Link href={prev} className="btn-icon h-10 w-10" aria-label="Previous month">
        <Icon d="m15 6-6 6 6 6" size={20} />
      </Link>
      <span className="text-[0.9375rem] font-semibold">{label}</span>
      <Link href={next} className="btn-icon h-10 w-10" aria-label="Next month">
        <Icon d={ICONS.chevron} size={20} />
      </Link>
    </div>
  );
}
