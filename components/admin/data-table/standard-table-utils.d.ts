export type ColumnLike = { key: string };

export function filterData<T = any>(data: T[], query: string, columns?: ColumnLike[]): T[];

export function sortData<T = any>(data: T[], sortKey?: string, order?: "asc" | "desc"): T[];

export function paginateData<T = any>(data: T[], page: number, pageSize: number): T[];

export function getEmptyState(options?: {
	title?: string;
	description?: string;
	action?: { href?: string; label?: string } | null;
}): { title: string; description: string; action?: { href?: string; label?: string } | null };

export function getErrorState(message?: string, options?: { title?: string; description?: string }): { title: string; description: string };
