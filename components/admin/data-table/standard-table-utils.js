export function filterData(data, query, columns = []) {
  const q = (query || "").trim().toLowerCase();

  if (!q) return data;

  return data.filter((row) => {
    return columns.some((col) => {
      const value = row[col.key];

      if (value == null) return false;

      return String(value).toLowerCase().includes(q);
    });
  });
}

export function sortData(data, sortKey, order = "asc") {
  if (!sortKey) return data;

  // Stable sort: decorate items with their original index, sort, then undecorate.
  const decorated = data.map((item, idx) => ({ item, idx }));

  decorated.sort((A, B) => {
    const a = A.item[sortKey];
    const b = B.item[sortKey];

    if (a == null && b == null) return A.idx - B.idx;
    if (a == null) return order === "asc" ? -1 : 1;
    if (b == null) return order === "asc" ? 1 : -1;

    if (typeof a === "number" && typeof b === "number") {
      const cmp = a - b;
      if (cmp !== 0) return order === "asc" ? cmp : -cmp;
      return A.idx - B.idx;
    }

    const cmp = String(a).localeCompare(String(b), undefined, { numeric: true });
    if (cmp !== 0) return order === "asc" ? cmp : -cmp;
    return A.idx - B.idx;
  });

  return decorated.map((d) => d.item);
}

export function paginateData(data, page, pageSize) {
  const start = page * pageSize;
  return data.slice(start, start + pageSize);
}

export function getEmptyState(options = {}) {
  const { title, description, action } = options;

  return {
    title: title || "No records",
    description: description || "There are no records to display.",
    action: action ? { href: action.href ?? "#", label: action.label ?? "Add" } : null,
  };
}

export function getErrorState(message, options = {}) {
  const { title } = options;

  return {
    title: title || "Unable to load",
    description: message || "An error occurred while loading data.",
  };
}
