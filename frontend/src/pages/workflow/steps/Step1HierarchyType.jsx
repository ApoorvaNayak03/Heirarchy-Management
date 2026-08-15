import { useEffect, useMemo, useState } from 'react';
import WorkflowSplitLayout, { FormPanelHeader, HierarchyTypePreview, PreviewPanelHeader } from '../../../components/SchemaPreviewView';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import Textarea from '../../../components/ui/Textarea';
import { WORKFLOW_STEPS } from '../../../constants/workflow';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { hierarchyTypeService } from '../../../services';

const emptyForm = { code: '', name: '', description: '', status: 'ACTIVE', allow_multiple_parents: false };

export default function Step1HierarchyType({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [existing, setExisting] = useState([]);
  const [mode, setMode] = useState(session.hierarchyTypeId ? 'existing' : 'create');
  const [selectedId, setSelectedId] = useState(session.hierarchyTypeId || '');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hierarchyTypeService.list().then((res) => setExisting(res.data)).catch(() => {});
  }, []);

  const previewData = useMemo(() => {
    if (mode === 'existing') {
      const selected = existing.find((t) => t.hierarchy_type_id === selectedId);
      if (!selected) return null;
      return {
        code: selected.code,
        name: selected.name,
        description: selected.description,
        status: selected.status,
        allow_multiple_parents: selected.allow_multiple_parents,
      };
    }
    return form;
  }, [mode, form, selectedId, existing]);

  const handleContinue = async () => {
    const next = {};
    if (mode === 'create') {
      if (!form.code.trim()) next.code = 'Code is required';
      if (!form.name.trim()) next.name = 'Name is required';
    } else if (!selectedId) {
      next.selected = 'Select a hierarchy type';
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (mode === 'existing') {
        completeStep(1, { hierarchyTypeId: selectedId });
        return;
      }
      const res = await hierarchyTypeService.create(form);
      completeStep(1, { hierarchyTypeId: res.data.hierarchy_type_id });
      showToast('Hierarchy type created', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create hierarchy type', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActions({ onContinue: handleContinue, loading, continueDisabled: false });
  }, [mode, form, selectedId, loading]);

  return (
    <WorkflowSplitLayout
      formPanel={(
        <>
          <FormPanelHeader
            title="Hierarchy Type"
            description="Create a new template or select existing — the blueprint preview updates live on the right."
          />
          <div className="flex-1 overflow-y-auto p-4">
            <div className="mb-5 flex gap-4 border-b border-[var(--color-border)] pb-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[13px] transition-colors has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)]">
                <input type="radio" checked={mode === 'create'} onChange={() => setMode('create')} />
                Create new
              </label>
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--color-border)] px-3 py-2 text-[13px] transition-colors has-[:checked]:border-[var(--color-accent)] has-[:checked]:bg-[var(--color-accent-muted)] ${!existing.length ? 'opacity-50' : ''}`}>
                <input type="radio" checked={mode === 'existing'} onChange={() => setMode('existing')} disabled={!existing.length} />
                Select existing
                {!existing.length && <span className="text-xs text-[var(--color-text-muted)]">(none yet)</span>}
              </label>
            </div>

            {mode === 'existing' ? (
              <FormField label="Hierarchy type" required error={errors.selected}>
                <Select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                  <option value="">Select...</option>
                  {existing.map((t) => (
                    <option key={t.hierarchy_type_id} value={t.hierarchy_type_id}>{t.code} — {t.name}</option>
                  ))}
                </Select>
              </FormField>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Code" required error={errors.code} hint="Unique identifier">
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                    placeholder="PRODUCT"
                    autoFocus
                  />
                </FormField>
                <FormField label="Name" required error={errors.name}>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Product Hierarchy"
                  />
                </FormField>
                <FormField label="Description" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="What this hierarchy represents..."
                  />
                </FormField>
                <FormField label="Status">
                  <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </Select>
                </FormField>
                <FormField label="Structure mode" hint="Allow nodes to have multiple parents (DAG).">
                  <label className="flex h-8 items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 text-[13px]">
                    <input
                      type="checkbox"
                      checked={form.allow_multiple_parents}
                      onChange={(e) => setForm({ ...form, allow_multiple_parents: e.target.checked })}
                    />
                    Allow multiple parents
                  </label>
                </FormField>
              </div>
            )}
          </div>
        </>
      )}
      previewPanel={(
        <>
          <PreviewPanelHeader
            title="Live Blueprint Preview"
            description="See your hierarchy template take shape as you configure it."
            badge={previewData?.allow_multiple_parents ? (
              <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">DAG</span>
            ) : previewData ? (
              <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">Tree</span>
            ) : null}
          />
          <HierarchyTypePreview
            data={previewData || emptyForm}
            mode={mode}
            workflowSteps={WORKFLOW_STEPS}
            currentStep={1}
          />
        </>
      )}
    />
  );
}
