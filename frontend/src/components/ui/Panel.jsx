export default function Panel({ title, description, actions, children, className = '' }) {
  return (
    <section className={`rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-[var(--color-border)] px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-[var(--color-text)]">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-[var(--color-text-muted)]">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}
