import React from "react";

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
};

export default function StandardTable<T>({ columns = [], data = [], className = "" }: Props<T>) {
  return (
    <div className={`smc-standard-table ${className}`}> 
      {/* Minimal table shell used by admin list pages; expand in implementation. */}
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key}>{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={Math.max(1, columns.length)}>
                No records
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr key={idx}>
                {columns.map((c) => (
                  <td key={c.key}>{c.render ? c.render(row) : (row as any)[c.key]}</td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
