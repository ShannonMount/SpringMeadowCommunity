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

  const copy = [...data];

  copy.sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];

    if (va == null && vb == null) return 0;
    if (va == null) return order === "asc" ? -1 : 1;
    if (vb == null) return order === "asc" ? 1 : -1;

    if (typeof va === "number" && typeof vb === "number") {
      return order === "asc" ? va - vb : vb - va;
    }

    return order === "asc"
      ? String(va).localeCompare(String(vb), undefined, { numeric: true })
      : String(vb).localeCompare(String(va), undefined, { numeric: true });
  });

  return copy;
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
