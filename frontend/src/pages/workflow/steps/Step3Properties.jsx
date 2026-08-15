import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import WorkflowSplitLayout, { FormPanelHeader, PreviewPanelHeader, PropertySchemaPreview } from '../../../components/SchemaPreviewView';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { nodeTypeService, propertyService } from '../../../services';
import { buildPropertyPreview } from '../../../utils/schemaPreview';

const DATA_TYPES = ['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ENUM', 'REFERENCE'];
const emptyForm = {
  node_type_id: '', property_code: '', display_label: '', data_type: 'STRING', required: false, allowed_values: '',
};

export default function Step3Properties({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [nodeTypes, setNodeTypes] = useState([]);
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const [nt, props] = await Promise.all([
      nodeTypeService.list({ hierarchy_type_id: session.hierarchyTypeId }),
      propertyService.list({ hierarchy_type_id: session.hierarchyTypeId }),
    ]);
    const sorted = [...nt.data].sort((a, b) => a.display_order - b.display_order);
    setNodeTypes(sorted);
    setItems(props.data);
    if (!form.node_type_id && sorted.length) {
      setForm((prev) => ({ ...prev, node_type_id: sorted[0].node_type_id }));
    }
  };

  useEffect(() => { if (session.hierarchyTypeId) load().catch(() => {}); }, [session.hierarchyTypeId]);

  const previewData = useMemo(
    () => buildPropertyPreview(nodeTypes, items, form),
    [nodeTypes, items, form],
  );

  const handleAdd = async () => {
    if (!form.node_type_id || !form.property_code.trim() || !form.display_label.trim()) {
      showToast('Node type, code, and label are required', 'error');
      return;
    }
    setSaving(true);
    try {
      await propertyService.create({
        hierarchy_type_id: session.hierarchyTypeId,
        node_type_id: form.node_type_id,
        property_code: form.property_code,
        display_label: form.display_label,
        data_type: form.data_type,
        required: form.required,
        allowed_values: form.data_type === 'ENUM' ? form.allowed_values.split(',').map((v) => v.trim()).filter(Boolean) : null,
      });
      showToast('Property added', 'success');
      setForm({ ...emptyForm, node_type_id: form.node_type_id });
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to add property', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await propertyService.delete(id);
      showToast('Property removed', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const handleContinue = async () => {
    setLoading(true);
    completeStep(3);
    setLoading(false);
  };

  useEffect(() => {
    setActions({ onContinue: handleContinue, loading, continueDisabled: false, continueLabel: items.length ? 'Continue' : 'Continue without properties' });
  }, [items, loading]);

  const totalProperties = items.length + (form.property_code?.trim() || form.display_label?.trim() ? 1 : 0);

  return (
    <WorkflowSplitLayout
      formPanel={(
        <>
          <FormPanelHeader
            title="Add Property"
            description="Select a node type and fill in details — property chips appear live on the right."
          />
          <div className="space-y-4 border-b border-[var(--color-border)] p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <FormField label="Node type" required>
                <Select value={form.node_type_id} onChange={(e) => setForm({ ...form, node_type_id: e.target.value })}>
                  <option value="">Select...</option>
                  {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
                </Select>
              </FormField>
              <FormField label="Data type" required>
                <Select value={form.data_type} onChange={(e) => setForm({ ...form, data_type: e.target.value })}>
                  {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </Select>
              </FormField>
              <FormField label="Property code" required>
                <Input value={form.property_code} onChange={(e) => setForm({ ...form, property_code: e.target.value })} placeholder="region_code" />
              </FormField>
              <FormField label="Display label" required>
                <Input value={form.display_label} onChange={(e) => setForm({ ...form, display_label: e.target.value })} placeholder="Region Code" />
              </FormField>
            </div>
            {form.data_type === 'ENUM' && (
              <FormField label="Allowed values" hint="Comma-separated">
                <Input value={form.allowed_values} onChange={(e) => setForm({ ...form, allowed_values: e.target.value })} placeholder="Active, Inactive" />
              </FormField>
            )}
            <label className="flex items-center gap-2 text-[13px]">
              <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} />
              Required property
            </label>
            <div className="flex justify-end">
              <Button
                onClick={handleAdd}
                disabled={saving || !form.node_type_id || !form.property_code.trim() || !form.display_label.trim()}
              >
                {saving ? 'Adding…' : 'Add property'}
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              Saved properties ({items.length})
            </div>
            {items.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">
                No properties saved yet. Optional — you can continue without any.
              </p>
            ) : (
              <div className="space-y-2">
                {items.map((item) => (
                  <div key={item.property_definition_id} className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{item.display_label}</div>
                      <div className="text-[11px] text-[var(--color-text-muted)]">
                        {nodeTypes.find((n) => n.node_type_id === item.node_type_id)?.name} · {item.data_type}
                        {item.required ? ' · required' : ''}
                      </div>
                    </div>
                    <button type="button" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => handleDelete(item.property_definition_id)}><Trash2 size={14} /></button>
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
            title="Live Schema Preview"
            description="Each node type shows its properties. Dashed chips are unsaved previews."
            badge={(
              <span className="rounded-full bg-[var(--color-accent-muted)] px-2.5 py-1 text-[11px] font-semibold text-[var(--color-accent)]">
                {totalProperties} propert{totalProperties !== 1 ? 'ies' : 'y'}
              </span>
            )}
          />
          <PropertySchemaPreview nodeTypesWithProperties={previewData} />
        </>
      )}
    />
  );
}
