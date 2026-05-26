"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

export type AdminWorkspaceNavItem = {
  label: string;
  href: string;
  enabled: boolean;
  currentStatus?: "available" | "planned";
  section?: "core" | "operations" | "records" | "settings";
};

type AdminWorkspaceNavProps = {
  items: AdminWorkspaceNavItem[];
};

function isActivePath(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

function itemClasses(isActive: boolean, enabled: boolean) {
  return [
    "block min-w-0 break-words rounded-sm border-l-4 px-3 py-2 text-sm font-semibold transition-colors",
    enabled
      ? "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
      : "cursor-not-allowed",
    isActive && enabled
      ? "border-[var(--gold)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
      : "border-transparent",
    enabled
      ? "text-[#263531] hover:bg-[var(--surface-muted)] hover:text-[var(--accent-strong)]"
      : "text-[#78837f]",
  ].join(" ");
}

function AdminNavItems({
  items,
  pathname,
  onNavigate,
}: {
  items: AdminWorkspaceNavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {items.map((item) => {
        const isActive = item.enabled && isActivePath(pathname, item.href);
        const className = itemClasses(isActive, item.enabled);

        return (
          <li key={item.href} className="min-w-0">
            {item.enabled ? (
              <Link
                href={item.href}
                className={className}
                aria-current={isActive ? "page" : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </Link>
            ) : (
              <span className={className} aria-disabled="true">
                {item.label}
              </span>
            )}
          </li>
        );
      })}
    </>
  );
}

export function AdminWorkspaceNav({ items }: AdminWorkspaceNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  function handleMobileMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      setIsOpen(false);
    }
  }

  return (
    <div
      className="border-b border-[var(--border)] bg-[var(--surface)]"
      onKeyDown={handleMobileMenuKeyDown}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:hidden">
        <p className="min-w-0 truncate text-sm font-semibold text-[var(--accent-strong)]">
          Admin workspace
        </p>
        <button
          type="button"
          className="min-h-10 rounded-sm border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[#263531] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--gold)]"
          aria-expanded={isOpen}
          aria-controls="admin-mobile-menu"
          onClick={() => setIsOpen((current) => !current)}
        >
          Menu
        </button>
      </div>

      <div
        id="admin-mobile-menu"
        className={isOpen ? "border-t border-[var(--border)] lg:hidden" : "hidden"}
      >
        <nav aria-label="Admin workspace" className="mx-auto max-w-7xl px-4 py-3 sm:px-6">
          <ul className="grid gap-1">
            <AdminNavItems
              items={items}
              pathname={pathname}
              onNavigate={() => setIsOpen(false)}
            />
          </ul>
        </nav>
      </div>

      <nav
        aria-label="Admin workspace"
        className="mx-auto hidden max-w-7xl px-4 py-3 sm:px-6 lg:block lg:px-8"
      >
        <ul className="flex flex-wrap items-center gap-1">
          <AdminNavItems items={items} pathname={pathname} />
        </ul>
      </nav>
    </div>
  );
}
