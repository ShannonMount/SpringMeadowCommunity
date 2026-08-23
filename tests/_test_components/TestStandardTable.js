import React, { useRef, useState } from "react";

export default function TestStandardTable({ columns = [] }) {
  const headerRefs = useRef({});
  const [sortKey, setSortKey] = useState(undefined);
  const [sortOrder, setSortOrder] = useState("asc");

  function toggleSort(key) {
    if (sortKey === key) {
      setSortOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortOrder("asc");
    }
  }

  function handleKeyDown(e, key, idx) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      toggleSort(key);
      return;
    }

    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const nextIdx = e.key === "ArrowRight" ? Math.min(columns.length - 1, idx + 1) : Math.max(0, idx - 1);
      const nextKey = columns[nextIdx].key;
      const nextEl = headerRefs.current[nextKey];
      if (nextEl && typeof nextEl.focus === "function") nextEl.focus();
    }
  }

  return React.createElement(
    "div",
    null,
    React.createElement("div", { "data-testid": "sort-state" }, `${sortKey || ""}:${sortOrder}`),
    React.createElement(
      "div",
      { role: "row" },
      columns.map((c, idx) =>
        React.createElement(
          "div",
          {
            key: c.key,
            "data-key": c.key,
            tabIndex: 0,
            role: c.sortable ? "button" : undefined,
            "aria-sort": c.sortable ? (sortKey === c.key ? (sortOrder === "asc" ? "ascending" : "descending") : "none") : undefined,
            ref: (el) => {
              headerRefs.current[c.key] = el;
            },
            onKeyDown: (e) => handleKeyDown(e, c.key, idx),
            onClick: c.sortable ? () => toggleSort(c.key) : undefined,
          },
          c.title
        )
      )
    )
  );
}
