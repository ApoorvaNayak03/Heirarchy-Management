import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import Panel from '../../../components/ui/Panel';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { versionService } from '../../../services';

export default function Step7Validate({ setActions }) {
  const { session, completeStep } = useWorkflow();
  const { showToast } = useToast();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);

  const runValidation = async () => {
    setLoading(true);
    try {
      const res = await versionService.validate(session.versionId);
      setResult(res.data);
      setRan(true);
    } catch {
      showToast('Validation failed to run', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (!result?.valid) {
      showToast('Resolve all validation errors before continuing', 'error');
      return;
    }
    completeStep(7);
  };

  useEffect(() => {
    setActions({
      onContinue: handleContinue,
      loading,
      continueDisabled: !result?.valid,
      continueLabel: result?.valid ? 'Continue' : 'Fix errors to continue',
    });
  }, [result, loading]);

  return (
    <div className="space-y-4">
      <Panel
        title="Validation"
        description="Run structural and property validation checks on the hierarchy version."
        actions={<Button onClick={runValidation} disabled={loading}>{loading ? 'Running...' : ran ? 'Re-run validation' : 'Run validation'}</Button>}
      >
        {!ran && !result && (
          <p className="text-[13px] text-[var(--color-text-muted)]">Click "Run validation" to check the hierarchy structure and property values.</p>
        )}

        {result && (
          <div className="space-y-4">
            <div className={`rounded-[var(--radius-sm)] border px-3 py-2 text-[13px] font-medium ${
              result.valid
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}>
              {result.valid ? 'Validation passed — no blocking errors found.' : 'Validation failed — resolve errors below before continuing.'}
            </div>

            {result.errors?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-red-700">Errors ({result.errors.length})</h3>
                <ul className="space-y-1.5">
                  {result.errors.map((e, i) => (
                    <li key={i} className="rounded-[var(--radius-sm)] border border-red-100 bg-red-50 px-3 py-2 text-[13px] text-red-800">
                      <span className="font-medium">{e.type}</span>: {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.warnings?.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-700">Warnings ({result.warnings.length})</h3>
                <ul className="space-y-1.5">
                  {result.warnings.map((e, i) => (
                    <li key={i} className="rounded-[var(--radius-sm)] border border-amber-100 bg-amber-50 px-3 py-2 text-[13px] text-amber-800">
                      {e.message}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
