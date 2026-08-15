const STATUS_COLORS = {
  ACTIVE: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  INACTIVE: 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]',
  DRAFT: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border-blue-200',
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  REJECTED: 'bg-red-50 text-red-700 border-red-200',
  RETIRED: 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  CANCELLED: 'bg-[var(--color-bg)] text-[var(--color-text-muted)] border-[var(--color-border)]',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  OPEN: 'bg-[var(--color-accent-muted)] text-[var(--color-accent)] border-blue-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

export default function StatusBadge({ status }) {
  const label = (status || '').replace(/_/g, ' ');
  const color = STATUS_COLORS[status] || 'bg-[var(--color-bg)] text-[var(--color-text-secondary)] border-[var(--color-border)]';
  return (
    <span className={`inline-flex rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}
