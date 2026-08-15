export default function DataTable({ columns, data, emptyMessage = 'No records found.' }) {
  if (!data?.length) {
    return (
      <div className="rounded-[var(--radius-md)] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-6 py-10 text-center text-[13px] text-[var(--color-text-muted)]">
        {emptyMessage}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]">
      <table className="min-w-full text-[13px]">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg)]">
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 text-left text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border)] bg-[var(--color-surface)]">
          {data.map((row, idx) => (
            <tr key={row.id || idx} className="hover:bg-[var(--color-bg)]/50">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-2.5 text-[var(--color-text)]">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
