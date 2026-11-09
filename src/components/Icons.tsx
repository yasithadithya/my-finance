/** Line icons in one consistent style (24px grid, round caps). */
export const ICONS = {
  home: "M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z",
  calendar: "M7.5 3v3M16.5 3v3M4 9h16M5.5 5h13A1.5 1.5 0 0 1 20 6.5v12a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-12A1.5 1.5 0 0 1 5.5 5zM9 14.5l2 2 4-4",
  history: "M3.5 12a8.5 8.5 0 1 0 2.5-6M3.5 4v4h4M12 8v4l3 2",
  wallet: "M19 8V6.5A1.5 1.5 0 0 0 17.5 5h-12A1.5 1.5 0 0 0 4 6.5v11A1.5 1.5 0 0 0 5.5 19h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 8H4M16 13.5h.01",
  plus: "M12 5v14M5 12h14",
  back: "M19 12H5M11 6l-6 6 6 6",
  chevron: "m9 6 6 6-6 6",
  chevronDown: "m6 9 6 6 6-6",
  check: "m5 12.5 4.5 4.5L19 7.5",
  bank: "M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18",
  cash: "M3 7h18v10H3zM12 14.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5zM6 10v.01M18 14v.01",
  piggy: "M5 11a6 5 0 0 1 11.5-2H19v3l-1.5 1v3h-2v2h-2v-1.5h-4V18h-2v-2.5A5 5 0 0 1 5 11zM14.5 10.5h.01M3 9.5c0 1 .7 1.5 2 1.5",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 0 1 7 0v3M12 15v2",
  card: "M3.5 6.5h17v11h-17zM3.5 10h17M7 14.5h3",
  loan: "M4 19h16M6 15V9M10 15V9M14 15V9M18 15V9M3 9l9-5 9 5",
  bell: "M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15zM10 20.5h4",
  alert: "M12 4 2.5 20h19zM12 10v4.5M12 17.5v.01",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7zM2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 6.5M18 14a6 6 0 0 1 3.5 6",
  repeat: "M4 12V9.5A3.5 3.5 0 0 1 7.5 6H20l-3-3M20 12v2.5a3.5 3.5 0 0 1-3.5 3.5H4l3 3",
  trend: "M3 17l6-6 4 4 8-8M15 7h6v6",
  logout: "M14 4h4.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H14M10 8l-4 4 4 4M6 12h10",
  edit: "M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4",
  scale: "M12 4v16M5 20h14M6 8h12M6 8l-3 6a3 3 0 0 0 6 0zM18 8l-3 6a3 3 0 0 0 6 0z",
} as const;

export function Icon({ d, size = 20, strokeWidth = 2, className }: { d: string; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d={d} />
    </svg>
  );
}

/** Small grey chevron at the end of a tappable row. */
export function RowChevron() {
  return <Icon d={ICONS.chevron} size={18} className="shrink-0 text-muted/70" />;
}
