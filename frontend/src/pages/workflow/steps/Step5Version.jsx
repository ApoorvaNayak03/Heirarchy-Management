import { useEffect, useState } from 'react';
import WorkflowSplitLayout, { FormPanelHeader, PreviewPanelHeader, VersionPreview } from '../../../components/SchemaPreviewView';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import Textarea from '../../../components/ui/Textarea';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { hierarchyService, versionService } from '../../../services';

export default function Step5Version({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [form, setForm] = useState({
    hierarchy_code: '',
    hierarchy_name: '',
    hierarchy_description: '',
    version_no: '1.0',
    version_name: 'Initial Version',
    description: '',
    valid_from: new Date().toISOString().slice(0, 10),
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(!!session.versionId);

  useEffect(() => {
    if (session.versionId) {
      versionService.get(session.versionId).then((res) => {
        setForm((prev) => ({
          ...prev,
          version_no: res.data.version_no,
          version_name: res.data.version_name || '',
          description: res.data.description || '',
          valid_from: res.data.valid_from || prev.valid_from,
        }));
      }).catch(() => {});
    }
  }, [session.versionId]);

  const validate = () => {
    const next = {};
    if (!session.hierarchyId && !form.hierarchy_code.trim()) next.hierarchy_code = 'Hierarchy code is required';
    if (!session.hierarchyId && !form.hierarchy_name.trim()) next.hierarchy_name = 'Hierarchy name is required';
    if (!form.version_no.trim()) next.version_no = 'Version number is required';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleContinue = async () => {
    if (session.versionId) {
      completeStep(5);
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      let hierarchyId = session.hierarchyId;
      if (!hierarchyId) {
        const hRes = await hierarchyService.create({
          hierarchy_type_id: session.hierarchyTypeId,
          code: form.hierarchy_code,
          name: form.hierarchy_name,
          description: form.hierarchy_description,
        });
        hierarchyId = hRes.data.hierarchy_id;
      }
      const vRes = await versionService.create(hierarchyId, {
        version_no: form.version_no,
        version_name: form.version_name,
        description: form.description,
        valid_from: form.valid_from,
      });
      completeStep(5, {
        hierarchyId,
        versionId: vRes.data.hierarchy_version_id,
        versionStatus: vRes.data.status,
      });
      setCreated(true);
      showToast('Hierarchy and version created', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create version', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActions({
      onContinue: handleContinue,
      loading,
      continueDisabled: false,
      continueLabel: session.versionId ? 'Continue' : 'Create & continue',
    });
  }, [form, loading, session.versionId, session.hierarchyId]);

  const hierarchyCreated = !!(session.hierarchyId || created);
  const versionCreated = !!(session.versionId || created);

  return (
    <WorkflowSplitLayout
      formPanel={(
        <>
          <FormPanelHeader
            title="Create Hierarchy & Version"
            description="Define the instance and initial draft version — preview updates as you type."
          />
          <div className="flex-1 space-y-6 overflow-y-auto p-4">
            {!hierarchyCreated ? (
              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                  Hierarchy instance
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Hierarchy code" required error={errors.hierarchy_code}>
                    <Input
                      value={form.hierarchy_code}
                      onChange={(e) => setForm({ ...form, hierarchy_code: e.target.value.toUpperCase() })}
                      placeholder="PROD_HIER"
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Hierarchy name" required error={errors.hierarchy_name}>
                    <Input
                      value={form.hierarchy_name}
                      onChange={(e) => setForm({ ...form, hierarchy_name: e.target.value })}
                      placeholder="Product Hierarchy 2026"
                    />
                  </FormField>
                  <FormField label="Description" className="sm:col-span-2">
                    <Textarea
                      rows={2}
                      value={form.hierarchy_description}
                      onChange={(e) => setForm({ ...form, hierarchy_description: e.target.value })}
                    />
                  </FormField>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
                Hierarchy instance already created for this workflow.
              </div>
            )}

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
                Version details
              </h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Version number" required error={errors.version_no}>
                  <Input
                    value={form.version_no}
                    onChange={(e) => setForm({ ...form, version_no: e.target.value })}
                    disabled={!!session.versionId}
                  />
                </FormField>
                <FormField label="Version name">
                  <Input
                    value={form.version_name}
                    onChange={(e) => setForm({ ...form, version_name: e.target.value })}
                    disabled={!!session.versionId}
                  />
                </FormField>
                <FormField label="Effective from" hint="Planned effective date for this version.">
                  <Input
                    type="date"
                    value={form.valid_from}
                    onChange={(e) => setForm({ ...form, valid_from: e.target.value })}
                    disabled={!!session.versionId}
                  />
                </FormField>
                <FormField label="Description" className="sm:col-span-2">
                  <Textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    disabled={!!session.versionId}
                  />
                </FormField>
              </div>
            </div>
          </div>
        </>
      )}
      previewPanel={(
        <>
          <PreviewPanelHeader
            title="Live Instance Preview"
            description="Hierarchy instance and version stack — dashed boxes are unsaved previews."
          />
          <VersionPreview
            form={form}
            hierarchyCreated={hierarchyCreated}
            versionCreated={versionCreated}
          />
        </>
      )}
    />
  );
}
