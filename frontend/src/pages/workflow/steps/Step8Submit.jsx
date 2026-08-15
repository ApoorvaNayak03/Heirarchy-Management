import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import Panel from '../../../components/ui/Panel';
import Textarea from '../../../components/ui/Textarea';
import StatusBadge from '../../../components/StatusBadge';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { versionService } from '../../../services';

export default function Step8Submit({ setActions }) {
  const { session, completeStep, updateSession } = useWorkflow();
  const { showToast } = useToast();
  const [version, setVersion] = useState(null);
  const [form, setForm] = useState({
    comment: '',
    approval_steps: [{ step_sequence: 1, approver_role_or_user: 'Supply Chain Manager' }],
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (session.versionId) {
      versionService.get(session.versionId).then((res) => {
        setVersion(res.data);
        updateSession({ versionStatus: res.data.status });
      }).catch(() => {});
    }
  }, [session.versionId]);

  const alreadySubmitted = version && !['DRAFT', 'REJECTED'].includes(version.status);

  const handleSubmit = async () => {
    const next = {};
    if (!form.comment.trim()) next.comment = 'Submission comment is required';
    if (form.approval_steps.some((s) => !s.approver_role_or_user.trim())) next.steps = 'All approval steps must have an approver';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await versionService.submit(session.versionId, form);
      const verRes = await versionService.get(session.versionId);
      setVersion(verRes.data);
      updateSession({ versionStatus: verRes.data.status });
      completeStep(8, { versionStatus: verRes.data.status });
      showToast('Submitted for approval', 'success');
    } catch (err) {
      const detail = err.response?.data?.detail;
      showToast(typeof detail === 'object' ? detail.message : detail || 'Submit failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const addStep = () => {
    setForm({
      ...form,
      approval_steps: [...form.approval_steps, { step_sequence: form.approval_steps.length + 1, approver_role_or_user: '' }],
    });
  };

  const removeStep = (idx) => {
    const steps = form.approval_steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_sequence: i + 1 }));
    setForm({ ...form, approval_steps: steps });
  };

  const handleContinue = async () => {
    if (alreadySubmitted) {
      completeStep(8);
      return;
    }
    await handleSubmit();
  };

  useEffect(() => {
    setActions({
      onContinue: handleContinue,
      loading,
      continueDisabled: false,
      continueLabel: alreadySubmitted ? 'Continue' : 'Submit & continue',
    });
  }, [form, loading, alreadySubmitted]);

  return (
    <div className="space-y-4">
      {version && (
        <div className="flex items-center gap-2 text-[13px]">
          <span className="text-[var(--color-text-muted)]">Version status:</span>
          <StatusBadge status={version.status} />
        </div>
      )}

      <Panel title="Submit for Approval" description="Add submission comments and define the sequential approval chain. The version will be locked after submission.">
        {alreadySubmitted ? (
          <p className="text-[13px] text-[var(--color-text-secondary)]">This version has already been submitted and is locked for editing.</p>
        ) : (
          <div className="space-y-4">
            <FormField label="Submission comment" required error={errors.comment} hint="Explain the purpose and scope of this change.">
              <Textarea rows={3} value={form.comment} onChange={(e) => setForm({ ...form, comment: e.target.value })} />
            </FormField>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-[var(--color-text-secondary)]">Approval steps</span>
                <Button variant="ghost" size="sm" onClick={addStep}><Plus size={14} /> Add step</Button>
              </div>
              {errors.steps && <p className="mb-2 text-xs text-red-600">{errors.steps}</p>}
              <div className="space-y-2">
                {form.approval_steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="w-8 text-center text-xs text-[var(--color-text-muted)]">{step.step_sequence}</span>
                    <Input
                      className="flex-1"
                      placeholder="Approver role or username"
                      value={step.approver_role_or_user}
                      onChange={(e) => {
                        const steps = [...form.approval_steps];
                        steps[idx].approver_role_or_user = e.target.value;
                        setForm({ ...form, approval_steps: steps });
                      }}
                    />
                    {form.approval_steps.length > 1 && (
                      <button type="button" className="p-1 text-red-600" onClick={() => removeStep(idx)}><Trash2 size={14} /></button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Panel>
    </div>
  );
}
