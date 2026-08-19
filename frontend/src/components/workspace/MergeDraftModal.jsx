import { AlertTriangle, GitMerge } from 'lucide-react';
import { useEffect, useState } from 'react';
import Modal from '../Modal';
import Button from '../ui/Button';
import { versionService } from '../../services';

function conflictKey(c) {
  return `${c.hierarchy_node_id}::${c.field}`;
}

function conflictFieldLabel(field) {
  if (field.startsWith('property:')) return `Property: ${field.slice('property:'.length)}`;
  if (field === 'display_name') return 'Name';
  if (field === 'parent') return 'Parent';
  return field;
}

export default function MergeDraftModal({ open, version, onClose, onMerged, showToast }) {
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState([]);
  const [choices, setChoices] = useState({});
  const [merging, setMerging] = useState(false);

  useEffect(() => {
    if (!open || !version) return;
    setLoading(true);
    versionService
      .conflicts(version.hierarchy_version_id)
      .then((res) => {
        const items = res.data.conflicts || [];
        setConflicts(items);
        setChoices(
          items.reduce((acc, c) => ({ ...acc, [conflictKey(c)]: 'draft' }), {}),
        );
      })
      .catch(() => showToast?.('Failed to load conflicts', 'error'))
      .finally(() => setLoading(false));
  }, [open, version, showToast]);

  if (!open || !version) return null;

  const handleMerge = async () => {
    setMerging(true);
    try {
      const resolutions = conflicts.map((c) => ({
        hierarchy_node_id: c.hierarchy_node_id,
        field: c.field,
        choice: choices[conflictKey(c)] || 'draft',
      }));
      await versionService.mergeDraft(version.hierarchy_version_id, resolutions);
      showToast?.('Draft merged into active version', 'success');
      onMerged?.();
      onClose();
    } catch (err) {
      showToast?.(err.response?.data?.detail?.message || err.response?.data?.detail || 'Merge failed', 'error');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Modal open={open} title="Merge draft into active version" onClose={onClose} wide>
      <div className="space-y-3">
        <p className="text-xs text-[var(--color-text-muted)]">
          Non-conflicting changes from <span className="font-semibold">{version.version_name || version.version_no}</span> will be applied
          automatically. Resolve any conflicts below before merging.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-[var(--color-text-muted)]">Checking for conflicts…</div>
        ) : conflicts.length === 0 ? (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            No conflicts — this draft can be merged directly.
          </div>
        ) : (
          <div className="max-h-96 space-y-2 overflow-y-auto">
            {conflicts.map((c) => {
              const key = conflictKey(c);
              return (
                <div key={key} className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs">
                  <div className="mb-1.5 flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle size={13} /> {c.node_name} — {conflictFieldLabel(c.field)}
                  </div>
                  <div className="mb-2 flex gap-4 text-[var(--color-text-secondary)]">
                    <span>Active: <span className="font-mono">{c.active_value ?? '—'}</span></span>
                    <span>Draft: <span className="font-mono">{c.proposed_value ?? '—'}</span></span>
                  </div>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={key}
                        checked={choices[key] === 'active'}
                        onChange={() => setChoices((prev) => ({ ...prev, [key]: 'active' }))}
                      />
                      Keep active
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        name={key}
                        checked={choices[key] !== 'active'}
                        onChange={() => setChoices((prev) => ({ ...prev, [key]: 'draft' }))}
                      />
                      Use draft
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button size="sm" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={handleMerge} disabled={loading || merging}>
            <GitMerge size={13} /> {merging ? 'Merging…' : 'Merge'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
