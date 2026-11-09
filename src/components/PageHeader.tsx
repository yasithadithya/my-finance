"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon, ICONS } from "@/components/Icons";

/**
 * One UI header: a big title with breathing room above it, and a compact bar
 * that picks up the title once the big one scrolls away.
 */
export default function PageHeader({
  title,
  back,
  action,
  children,
}: {
  title: string;
  back?: { href: string; label: string };
  /** Buttons on the right of the top bar. */
  action?: React.ReactNode;
  /** Shown under the big title (amounts, subtitles, month switcher). */
  children?: React.ReactNode;
}) {
  const ref = useRef<HTMLHeadingElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setStuck(!e.isIntersecting), { rootMargin: "-56px 0px 0px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <header>
      <div className={`appbar ${stuck ? "is-stuck" : ""}`}>
        {back ? (
          <Link href={back.href} className="btn-icon" aria-label={`Back to ${back.label}`}>
            <Icon d={ICONS.back} size={22} />
          </Link>
        ) : (
          <span className="w-2" />
        )}
        <span className="appbar-title" aria-hidden>{title}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">{action}</div>
      </div>
      <div className="title-area">
        <h1 ref={ref} className="large-title">{title}</h1>
        {children}
      </div>
    </header>
  );
}

/** Round "+" button for the top bar. */
export function AddAction({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="btn-icon" aria-label={label} title={label}>
      <Icon d={ICONS.plus} size={24} />
    </Link>
  );
}
