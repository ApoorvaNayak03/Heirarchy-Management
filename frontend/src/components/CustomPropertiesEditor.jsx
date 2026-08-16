import { useState } from 'react';
import { Plus, X } from 'lucide-react';

function coerceValue(raw) {
  if (raw.trim() === '') return raw;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return Number(raw);
  return raw;
}

export default function CustomPropertiesEditor({ properties, definedCodes = [], onChange }) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const customEntries = Object.entries(properties || {}).filter(([key]) => !definedCodes.includes(key));

  const addField = () => {
    const key = newKey.trim();
    if (!key) return;
    onChange({ ...properties, [key]: coerceValue(newValue) });
    setNewKey('');
    setNewValue('');
  };

  const removeField = (key) => {
    const next = { ...properties };
    delete next[key];
    onChange(next);
  };

  const updateValue = (key, raw) => {
    onChange({ ...properties, [key]: coerceValue(raw) });
  };

  return (
    <div className="space-y-2">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Custom fields
      </div>
      {customEntries.map(([key, value]) => (
        <div key={key} className="flex items-center gap-2">
          <input
            className="h-8 w-1/3 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] text-[var(--color-text-muted)]"
            value={key}
            disabled
          />
          <input
            className="h-8 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
            value={value ?? ''}
            onChange={(e) => updateValue(key, e.target.value)}
          />
          <button
            type="button"
            onClick={() => removeField(key)}
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-red-600"
            aria-label={`Remove ${key}`}
          >
            <X size={14} />
          </button>
        </div>
      ))}
      <div className="flex items-center gap-2">
        <input
          className="h-8 w-1/3 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          placeholder="e.g. quantity"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
        />
        <input
          className="h-8 flex-1 rounded-[var(--radius-sm)] border border-[var(--color-border-strong)] bg-white px-2.5 text-[13px] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)]"
          placeholder="value"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addField(); } }}
        />
        <button
          type="button"
          onClick={addField}
          disabled={!newKey.trim()}
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-accent)] hover:bg-[var(--color-accent-muted)] disabled:opacity-40"
          aria-label="Add field"
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
