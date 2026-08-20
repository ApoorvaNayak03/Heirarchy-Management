export default function PropertyFieldRenderer({ definition, value, onChange }) {
  const dtype = definition.data_type;
  const common = 'h-8 w-full rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]';

  if (dtype === 'BOOLEAN') {
    return (
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
        {definition.display_label}
      </label>
    );
  }
  if (dtype === 'ENUM') {
    return (
      <select className={common} value={value || ''} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {(definition.allowed_values || []).map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }
  if (dtype === 'DATE') {
    return <input type="date" className={common} value={value || ''} onChange={(e) => onChange(e.target.value)} />;
  }
  if (dtype === 'NUMBER') {
    return <input type="number" className={common} value={value ?? ''} onChange={(e) => onChange(Number(e.target.value))} />;
  }
  if (dtype === 'ROLLUP') {
    return <input type="number" disabled className={`${common} cursor-not-allowed bg-[var(--color-bg)] text-[var(--color-text-muted)]`} value={value ?? 0} />;
  }
  return <input type="text" className={common} value={value != null && value !== '' ? String(value) : ''} onChange={(e) => onChange(e.target.value)} />;
}
