"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { residentPortalNavigationItems } from "@/lib/resident/portal-navigation";

function isActivePath(pathname: string, href: string) {
  return href === "/portal" ? pathname === "/portal" : pathname.startsWith(href);
}

function navLinkClasses(isActive: boolean) {
  return [
    "block min-w-0 break-words rounded-sm border-l-4 px-3 py-2 text-sm font-semibold transition-colors",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]",
    isActive
      ? "border-[var(--gold)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : "border-transparent text-[#263531] hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]",
  ].join(" ");
}

export function ResidentPortalNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function handleMobileMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:hidden">
        <p className="min-w-0 truncate text-sm font-semibold text-[var(--accent-strong)]">
          Resident portal
        </p>
        <button
          type="button"
          className="min-h-10 rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#263531] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          aria-expanded={isOpen}
          aria-controls="resident-mobile-menu"
          onClick={() => setIsOpen((current) => !current)}
        >
          Menu
        </button>
      </div>

      <div
        id="resident-mobile-menu"
        onKeyDown={handleMobileMenuKeyDown}
        className={isOpen ? "border-t border-[var(--border)] lg:hidden" : "hidden"}
      >
        <nav aria-label="Resident portal" className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <ul className="grid gap-1">
            {residentPortalNavigationItems.map((item) => {
              const isActive = isActivePath(pathname, item.href);

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={navLinkClasses(isActive)}
                    aria-current={isActive ? "page" : undefined}
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

      <nav aria-label="Resident portal" className="mx-auto hidden max-w-7xl px-4 py-3 sm:px-6 lg:block lg:px-8">
        <ul className="flex flex-wrap items-center gap-1">
          {residentPortalNavigationItems.map((item) => {
            const isActive = isActivePath(pathname, item.href);

            return (
              <li key={item.href} className="min-w-0">
                <Link
                  href={item.href}
                  className={navLinkClasses(isActive)}
                  aria-current={isActive ? "page" : undefined}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
