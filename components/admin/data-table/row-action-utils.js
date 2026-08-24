export function buildRowActionMap(rowActions, data, rowKey) {
  if (!Array.isArray(rowActions)) return null;

  if (!rowKey) {
    throw new Error('rowKey is required when rowActions is an array');
  }

  const m = new Map();
  const seen = new Set();
  data.forEach((d, i) => {
    const id = typeof rowKey === 'function' ? rowKey(d) : d[rowKey];
    const sid = id != null ? String(id) : String(i);
    if (seen.has(sid)) {
      // eslint-disable-next-line no-console
      console.warn('duplicate rowKey value detected:', sid);
    } else {
      seen.add(sid);
    }
    m.set(sid, rowActions[i] ?? null);
  });

  return m;
}

export function buildStableIdMap(data, rowKey) {
  const map = new Map();
  data.forEach((d, i) => {
    const id = rowKey ? (typeof rowKey === 'function' ? rowKey(d) : d[rowKey]) : undefined;
    const sid = id != null ? String(id) : `__gen_${i}`;
    map.set(d, sid);
  });
  return map;
}