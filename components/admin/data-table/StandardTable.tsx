"use client";

import React, { useMemo, useState, useRef } from "react";
import { filterData, sortData, paginateData, getEmptyState, getErrorState } from "./standard-table-utils.js";

export type Column<T = any> = {
  key: string;
  title: string;
  sortable?: boolean;
  render?: (row: T) => React.ReactNode;
};

type Props<T = any> = {
  columns?: Column<T>[];
  data?: T[];
  className?: string;
  pageSize?: number;
  rowActions?: React.ReactNode[] | ((row: T) => React.ReactNode);
  rowKey?: string | ((row: T) => string | number);
  error?: string | null;
};

export type SortOrder = "asc" | "desc";

export default function StandardTable<T>({
  columns = [],
  data = [],
  className = "",
  pageSize = 25,
  rowActions,
  rowKey,
  error = null,
}: Props<T>) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | undefined>(undefined);
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  const [page, setPage] = useState(0);
  const headerRefs = useRef<Record<string, HTMLElement | null>>({});

  const filtered = useMemo(() => filterData(data, query, columns), [data, query, columns]);
  const sorted = useMemo(() => sortData(filtered, sortKey, sortOrder), [filtered, sortKey, sortOrder]);
  const paged = useMemo(() => paginateData(sorted, page, pageSize), [sorted, page, pageSize]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));

  const emptyContents = getEmptyState();
  const errorContents = error ? getErrorState(error) : null;

  // Build a mapping from stable row id -> action when an array of rowActions
  const rowActionMap = useMemo(() => {
    if (!Array.isArray(rowActions) || !rowKey) return null;
    const m = new Map();
    data.forEach((d, i) => {
      const id = typeof rowKey === "function" ? rowKey(d) : (d as any)[rowKey];
      if (id != null) m.set(String(id), rowActions[i] ?? null);
    });
    return m;
  }, [rowActions, data, rowKey]);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
    setPage(0);
    // restore focus to the header cell after sorting for keyboard users
    setTimeout(() => {
      const el = headerRefs.current[key];
      try {
        el?.focus();
      } catch (e) {
        /* noop */
      }
    }, 0);
  }

  return (
    <div className={`smc-standard-table ${className}`}>
      {errorContents ? (
        <div role="alert" aria-live="assertive" aria-atomic="true" className="mb-3 rounded-sm border border-red-400 bg-red-50 px-3 py-2 text-sm">
          <h3 className="font-semibold">{errorContents.title}</h3>
          <p className="mt-1">{errorContents.description}</p>
        </div>
      ) : null}

      <div className="smc-table-controls mb-3 flex items-center justify-between">
        <input
          aria-label="Search"
          placeholder="Search..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="rounded-sm border px-3 py-1 text-sm"
        />
        <div className="smc-pagination flex gap-2">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="px-3 py-1 rounded-sm border"
          >
            Prev
          </button>
          <span className="text-sm">
            Page {page + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="px-3 py-1 rounded-sm border"
          >
            Next
          </button>
        </div>
      </div>

      <table className="w-full table-fixed">
        <thead>
          <tr>
            {columns.map((c, idx) => (
              <th
                key={c.key}
                ref={(el) => {
                  headerRefs.current[c.key] = el;
                }}
                className={`text-left px-2 py-1 ${c.sortable ? "cursor-pointer" : ""}`}
                onClick={c.sortable ? () => toggleSort(c.key) : undefined}
                onKeyDown={(e: React.KeyboardEvent) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (c.sortable) toggleSort(c.key);
                    return;
                  }

                  if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
                    e.preventDefault();
                    const nextIdx = e.key === "ArrowRight" ? Math.min(columns.length - 1, idx + 1) : Math.max(0, idx - 1);
                    const nextKey = columns[nextIdx].key;
                    const nextEl = headerRefs.current[nextKey];
                    try {
                      nextEl?.focus();
                    } catch (err) {
                      /* noop */
                    }
                  }
                }}
                role={c.sortable ? "button" : undefined}
                tabIndex={0}
                aria-sort={
                  c.sortable
                    ? sortKey === c.key
                      ? sortOrder === "asc"
                        ? "ascending"
                        : "descending"
                      : "none"
                    : undefined
                }
                scope="col"
              >
                <div className="flex items-center gap-2">
                  <span>{c.title}</span>
                  {c.sortable && sortKey === c.key ? (
                    <span aria-hidden>{sortOrder === "asc" ? "▲" : "▼"}</span>
                  ) : null}
                </div>
              </th>
            ))}
            {rowActions ? <th className="text-left px-2 py-1">Actions</th> : null}
          </tr>
        </thead>
        <tbody>
          {paged.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length + (rowActions ? 1 : 0))} className="px-2 py-6 text-center text-sm">
                <div role="status" aria-live="polite" aria-atomic="true">
                  <h3 className="text-sm font-semibold">{emptyContents.title}</h3>
                  <p className="mt-1 text-sm">{emptyContents.description}</p>
                  {emptyContents.action ? (
                    <div className="mt-3">
                      <a href={emptyContents.action.href} className="inline-flex rounded-sm border px-3 py-1 text-sm">
                        {emptyContents.action.label}
                      </a>
                    </div>
                  ) : null}
                </div>
              </td>
            </tr>
          ) : (
            paged.map((row, rowIdx) => (
              <tr key={rowIdx} className={rowIdx % 2 === 0 ? "bg-white" : "bg-surface-muted"}>
                {columns.map((c) => (
                  <td key={c.key} className="px-2 py-2 align-top text-sm">
                    {c.render ? c.render(row) : String((row as any)[c.key] ?? "")}
                  </td>
                ))}
                {rowActions ? (
                  <td className="px-2 py-2">
                    {(() => {
                      if (typeof rowActions === "function") {
                        return (rowActions as (r: T) => React.ReactNode)(row);
                      }

                      // If we have a stable rowActionMap and a rowKey, use id mapping
                      if (rowActionMap && rowKey) {
                        const id = typeof rowKey === "function" ? rowKey(row) : (row as any)[rowKey];
                        return id != null ? rowActionMap.get(String(id)) ?? null : null;
                      }

                      // Fallback: align by original array index using identity
                      const originalIndex = data.indexOf(row as any);
                      return originalIndex >= 0 ? (rowActions as React.ReactNode[])[originalIndex] ?? null : null;
                    })()}
                  </td>
                ) : null}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
