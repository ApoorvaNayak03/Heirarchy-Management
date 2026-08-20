import { forwardRef, useImperativeHandle, useState } from 'react';
import { Plus, Sparkles, Trash2 } from 'lucide-react';
import Button from './ui/Button';
import FormField from './ui/FormField';
import Input from './ui/Input';

function coerceValue(raw) {
  if (raw.trim() === '') return raw;
  if (!Number.isNaN(Number(raw)) && raw.trim() !== '') return Number(raw);
  return raw;
}

function mergePending(properties, key, value) {
  const trimmed = key?.trim();
  if (!trimmed) return properties || {};
  return { ...(properties || {}), [trimmed]: coerceValue(value ?? '') };
}

const CustomPropertiesEditor = forwardRef(function CustomPropertiesEditor(
  { properties, definedCodes = [], onChange },
  ref,
) {
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');

  const customEntries = Object.entries(properties || {}).filter(([key]) => !definedCodes.includes(key));

  const commitPending = () => {
    const key = newKey.trim();
    if (!key) return properties || {};
    const merged = mergePending(properties, key, newValue);
    onChange(merged);
    setNewKey('');
    setNewValue('');
    return merged;
  };

  useImperativeHandle(ref, () => ({
    flushPending() {
      return commitPending();
    },
  }));

  const addField = () => {
    if (!newKey.trim()) return;
    commitPending();
  };

  const removeField = (key) => {
    const next = { ...properties };
    delete next[key];
    onChange(next);
  };

  const updateValue = (key, raw) => {
    onChange({ ...properties, [key]: coerceValue(raw) });
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addField();
    }
  };

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      <div className="mb-3 flex items-start gap-2">
        <Sparkles size={14} className="mt-0.5 shrink-0 text-[var(--color-accent)]" />
        <div>
          <div className="text-xs font-semibold text-[var(--color-text)]">Additional fields</div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-muted)]">
            Optional extra data for this node. New field names are saved for all nodes of this type.
          </p>
        </div>
      </div>

      {customEntries.length > 0 && (
        <div className="mb-3 space-y-2">
          {customEntries.map(([key, value]) => (
            <div
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_auto] items-end gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] p-2"
            >
              <FormField label="Field name">
                <Input value={key} disabled className="font-mono text-[12px]" />
              </FormField>
              <FormField label="Value">
                <Input
                  value={value ?? ''}
                  onChange={(e) => updateValue(key, e.target.value)}
                />
              </FormField>
              <button
                type="button"
                onClick={() => removeField(key)}
                className="mb-0.5 flex h-8 w-8 items-center justify-center rounded-[var(--radius-sm)] text-[var(--color-text-muted)] hover:bg-red-50 hover:text-red-600"
                aria-label={`Remove ${key}`}
                title="Remove field"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] p-3">
        <div className="mb-2 text-[11px] font-medium text-[var(--color-text-secondary)]">
          {customEntries.length ? 'Add another field' : 'Add a field'}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Field name" hint="e.g. commission_rate">
            <Input
              value={newKey}
              onChange={(e) => setNewKey(e.target.value.replace(/\s+/g, '_'))}
              onKeyDown={handleKeyDown}
              placeholder="commission_rate"
            />
          </FormField>
          <FormField label="Value" hint="Press Enter to add">
            <Input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="0.12"
            />
          </FormField>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[10px] text-[var(--color-text-muted)]">
            Tip: click Add field, or press Enter — pending fields are included when you save the node.
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={addField}
            disabled={!newKey.trim()}
          >
            <Plus size={14} /> Add field
          </Button>
        </div>
      </div>
    </div>
  );
});

export default CustomPropertiesEditor;
