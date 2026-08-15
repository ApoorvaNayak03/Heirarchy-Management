import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Trash2 } from 'lucide-react';
import WorkflowSplitLayout, { FormPanelHeader, NodeTypeLadderPreview, PreviewPanelHeader } from '../../../components/SchemaPreviewView';
import StatusBadge from '../../../components/StatusBadge';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { nodeTypeService } from '../../../services';
import { buildNodeTypePreview } from '../../../utils/schemaPreview';

const emptyForm = { code: '', name: '', description: '' };

export default function Step2NodeTypes({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => nodeTypeService.list({ hierarchy_type_id: session.hierarchyTypeId }).then((res) => {
    setItems([...res.data].sort((a, b) => a.display_order - b.display_order));
  });

  useEffect(() => { if (session.hierarchyTypeId) load().catch(() => {}); }, [session.hierarchyTypeId]);

  const previewNodeTypes = useMemo(
    () => buildNodeTypePreview(items, form),
    [items, form],
  );

  const handleAdd = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      showToast('Code and name are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await nodeTypeService.create({
        ...form,
        hierarchy_type_id: session.hierarchyTypeId,
        display_order: items.length + 1,
      });
      showToast('Node type added', 'success');
      setForm(emptyForm);
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add node type', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await nodeTypeService.delete(id);
      showToast('Node type removed', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const moveItem = async (index, direction) => {
    const next = [...items];
    const swapIdx = index + direction;
    if (swapIdx < 0 || swapIdx >= next.length) return;
    [next[index], next[swapIdx]] = [next[swapIdx], next[index]];
    const payload = next.map((item, idx) => ({ node_type_id: item.node_type_id, display_order: idx + 1 }));
    setItems(next.map((item, idx) => ({ ...item, display_order: idx + 1 })));
    try {
      await nodeTypeService.reorder(payload);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Reorder failed', 'error');
      load();
    }
  };

  const handleContinue = async () => {
    if (items.length < 1) {
      showToast('Add at least one node type', 'error');
      return;
    }
    setLoading(true);
    completeStep(2);
    setLoading(false);
  };

  useEffect(() => {
    setActions({ onContinue: handleContinue, loading, continueDisabled: items.length < 1 });
  }, [items, loading]);

  return (
    <WorkflowSplitLayout
      formPanel={(
        <>
          <FormPanelHeader
            title="Add Node Type"
            description="Type below — the preview on the right updates instantly as you fill in the form."
          />
          <div className="space-y-4 border-b border-[var(--color-border)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Code" required hint="Short identifier, e.g. DIVISION">
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="DIVISION"
                  autoFocus
                />
              </FormField>
              <FormField label="Name" required>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Division"
                />
              </FormField>
            </div>
            <FormField label="Description">
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Optional description"
              />
            </FormField>
            <div className="flex justify-end">
              <Button onClick={handleAdd} disabled={saving || !form.code.trim() || !form.name.trim()}>
                {saving ? 'Adding…' : 'Add to hierarchy'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Defined types ({items.length})
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
                No node types saved yet. Fill in the form above to see a live preview, then click Add.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item, idx) => (
                  <div
                    key={item.node_type_id}
                    className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5"
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--color-accent-muted)] text-[11px] font-bold text-[var(--color-accent)]">
                      {item.display_order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{item.name}</div>
                      <div className="font-mono text-[11px] text-[var(--color-text-muted)]">{item.code}</div>
                    </div>
                    <StatusBadge status={item.status} />
                    <div className="flex shrink-0 gap-0.5">
                      <button type="button" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]" onClick={() => moveItem(idx, -1)} title="Move up"><ArrowUp size={14} /></button>
                      <button type="button" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-white hover:text-[var(--color-text)]" onClick={() => moveItem(idx, 1)} title="Move down"><ArrowDown size={14} /></button>
                      <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.node_type_id)} title="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      previewPanel={(
        <>
          <PreviewPanelHeader
            title="Live Hierarchy Preview"
            description="Top-to-bottom order of node types. Dashed boxes are unsaved previews."
            badge={(
              <span className="rounded-full bg-[var(--color-accent-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                {previewNodeTypes.length} level{previewNodeTypes.length !== 1 ? 's' : ''}
              </span>
            )}
          />
          <NodeTypeLadderPreview nodeTypes={previewNodeTypes} />
        </>
      )}
    />
  );
}
