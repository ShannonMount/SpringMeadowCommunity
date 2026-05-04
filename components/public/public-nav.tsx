"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { publicNavigationItems } from "@/lib/public/navigation";

function navLinkClasses(isActive: boolean) {
  return [
    "rounded-sm px-3 py-2 text-sm font-medium transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]",
    isActive
      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : "text-[#263531] hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]",
  ].join(" ");
}

export function PublicNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function handleMobileMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="min-w-0 text-base font-semibold text-[var(--accent-strong)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--gold)]"
        >
          <span className="block truncate">Spring Meadow Community</span>
        </Link>

        <nav aria-label="Primary" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {publicNavigationItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link href={item.href} className={navLinkClasses(isActive)}>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          className="inline-flex items-center rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-medium text-[#263531] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)] lg:hidden"
          aria-expanded={isOpen}
          aria-controls="public-mobile-menu"
          onClick={() => setIsOpen((current) => !current)}
        >
          Menu
        </button>
      </div>

      <div
        id="public-mobile-menu"
        onKeyDown={handleMobileMenuKeyDown}
        className={isOpen ? "border-t border-[var(--border)] lg:hidden" : "hidden"}
      >
        <nav aria-label="Primary mobile" className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <ul className="grid gap-1">
            {publicNavigationItems.map((item) => {
              const isActive =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`${navLinkClasses(isActive)} block whitespace-normal break-words`}
                    onClick={() => setIsOpen(false)}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </header>
  );
}
