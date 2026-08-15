import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import SchemaGraphView from '../../../components/SchemaGraphView';
import WorkflowSplitLayout, { FormPanelHeader, PreviewPanelHeader } from '../../../components/SchemaPreviewView';
import StatusBadge from '../../../components/StatusBadge';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Select from '../../../components/ui/Select';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { hierarchyTypeService, nodeTypeService, structuralRuleService } from '../../../services';
import { buildStructuralRulesPreview } from '../../../utils/schemaPreview';

const emptyForm = { parent_node_type_id: '', child_node_type_id: '' };

export default function Step4StructuralRules({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [hierarchyType, setHierarchyType] = useState(null);
  const [nodeTypes, setNodeTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [ht, nt, rules] = await Promise.all([
      hierarchyTypeService.get(session.hierarchyTypeId),
      nodeTypeService.list({ hierarchy_type_id: session.hierarchyTypeId }),
      structuralRuleService.list({ hierarchy_type_id: session.hierarchyTypeId }),
    ]);
    setHierarchyType(ht.data);
    setNodeTypes([...nt.data].sort((a, b) => a.display_order - b.display_order));
    setItems(rules.data);
  };

  useEffect(() => { if (session.hierarchyTypeId) load().catch(() => {}); }, [session.hierarchyTypeId]);

  const preview = useMemo(
    () => buildStructuralRulesPreview(nodeTypes, items, form),
    [nodeTypes, items, form],
  );

  const ruleExists = (parentId, childId) =>
    items.some(
      (item) =>
        item.parent_node_type_id === parentId && item.child_node_type_id === childId,
    );

  const handleAdd = async () => {
    if (!form.parent_node_type_id || !form.child_node_type_id) {
      showToast('Select both parent and child node types', 'error');
      return;
    }
    if (ruleExists(form.parent_node_type_id, form.child_node_type_id)) {
      showToast('This parent-child relationship is already defined', 'info');
      setForm(emptyForm);
      return;
    }
    setSaving(true);
    try {
      await structuralRuleService.create({
        hierarchy_type_id: session.hierarchyTypeId,
        parent_node_type_id: form.parent_node_type_id,
        child_node_type_id: form.child_node_type_id,
      });
      showToast('Rule added', 'success');
      setForm(emptyForm);
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add rule', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await structuralRuleService.delete(id);
      showToast('Rule removed', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const handleContinue = async () => {
    if (items.length < 1) {
      showToast('Define at least one parent-child relationship', 'error');
      return;
    }
    setLoading(true);
    completeStep(4);
    setLoading(false);
  };

  useEffect(() => {
    setActions({ onContinue: handleContinue, loading, continueDisabled: items.length < 1 });
  }, [items, loading]);

  const edgeCount = preview.edges.length;

  return (
    <div className="space-y-4">
      {hierarchyType && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-4 py-3 text-[13px] text-[var(--color-text-secondary)]">
          Parent behavior: <strong>{hierarchyType.allow_multiple_parents ? 'Multiple parents allowed (DAG)' : 'Single parent only'}</strong>
          {' '}— configured in Step 1.
        </div>
      )}

      <WorkflowSplitLayout
        formPanel={(
          <>
            <FormPanelHeader
              title="Add Structural Rule"
              description="Pick parent and child types — the relationship graph updates instantly on the right."
            />
            <div className="space-y-4 border-b border-[var(--color-border)] p-4">
              <FormField label="Parent node type" required hint="Can contain the child type below">
                <Select value={form.parent_node_type_id} onChange={(e) => setForm({ ...form, parent_node_type_id: e.target.value })}>
                  <option value="">Select parent...</option>
                  {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Child node type" required hint="Must be allowed under the parent">
                <Select value={form.child_node_type_id} onChange={(e) => setForm({ ...form, child_node_type_id: e.target.value })}>
                  <option value="">Select child...</option>
                  {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
                </Select>
              </FormField>
              <div className="flex justify-end">
                <Button
                  onClick={handleAdd}
                  disabled={
                    saving
                    || !form.parent_node_type_id
                    || !form.child_node_type_id
                    || ruleExists(form.parent_node_type_id, form.child_node_type_id)
                  }
                >
                  {saving ? 'Adding…' : 'Add rule'}
                </Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Saved rules ({items.length})
              </div>
              {items.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
                  No rules saved yet. Select parent and child above to see a live preview, then click Add.
                </p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => (
                    <div key={item.structural_rule_id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2.5">
                      <div className="min-w-0 flex-1 text-sm">
                        <span className="font-medium">{item.parent_node_type_name}</span>
                        <span className="mx-2 text-[var(--color-text-muted)]">→</span>
                        <span className="font-medium">{item.child_node_type_name}</span>
                      </div>
                      <StatusBadge status={item.status} />
                      <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.structural_rule_id)}><Trash2 size={14} /></button>
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
              title="Live Structure Graph"
              description="Arrows show allowed parent → child relationships. Dashed lines are unsaved previews."
              badge={(
                <span className="rounded-full bg-[var(--color-accent-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                  {edgeCount} rule{edgeCount !== 1 ? 's' : ''}
                </span>
              )}
            />
            <div className="flex-1 p-4">
              <SchemaGraphView nodeTypes={preview.nodeTypes} edges={preview.edges} />
            </div>
          </>
        )}
      />
    </div>
  );
}
