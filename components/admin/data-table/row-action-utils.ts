type RowKey<T> = keyof T | ((row: T) => unknown);

export function buildRowActionMap<T extends object, TAction>(
  rowActions: Array<TAction | null | undefined>,
  data: T[],
  rowKey: RowKey<T>
): Map<string, TAction | null> | null {
  if (!Array.isArray(rowActions)) return null;

  if (!rowKey) {
    throw new Error('rowKey is required when rowActions is an array');
  }

  const m = new Map<string, TAction | null>();
  const seen = new Set<string>();

  data.forEach((d: T, i: number) => {
    const id =
      typeof rowKey === 'function'
        ? rowKey(d)
        : d[rowKey];

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

export function buildStableIdMap<T extends object>(
  data: T[],
  rowKey?: RowKey<T>
): Map<T, string> {
  const map = new Map<T, string>();

  data.forEach((d: T, i: number) => {
    const id = rowKey
      ? typeof rowKey === 'function'
        ? rowKey(d)
        : d[rowKey]
      : undefined;

    const sid = id != null ? String(id) : `__gen_${i}`;
    map.set(d, sid);
  });

  return map;
}