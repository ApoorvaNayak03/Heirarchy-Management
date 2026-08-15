import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import Panel from '../../../components/ui/Panel';
import StatusBadge from '../../../components/StatusBadge';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { versionService } from '../../../services';

export default function Step10Activate({ setActions }) {
  const { session, completeStep, updateSession } = useWorkflow();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [version, setVersion] = useState(null);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));
  const [activateNow, setActivateNow] = useState(true);
  const [loading, setLoading] = useState(false);
  const [activated, setActivated] = useState(false);

  useEffect(() => {
    if (session.versionId) {
      versionService.get(session.versionId).then((res) => {
        setVersion(res.data);
        if (res.data.status === 'ACTIVE') {
          setActivated(true);
          updateSession({ versionStatus: 'ACTIVE' });
        }
        if (res.data.valid_from) setValidFrom(res.data.valid_from);
      }).catch(() => {});
    }
  }, [session.versionId]);

  const handleActivate = async () => {
    setLoading(true);
    try {
      const payload = activateNow ? {} : { valid_from: validFrom };
      const res = await versionService.activate(session.versionId, payload);
      setVersion(res.data);
      setActivated(true);
      updateSession({ versionStatus: 'ACTIVE' });
      completeStep(10, { versionStatus: 'ACTIVE' });
      showToast('Version activated successfully', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Activation failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setActions({
      onContinue: activated ? null : handleActivate,
      loading,
      continueDisabled: !activateNow && !validFrom,
      continueLabel: activated ? undefined : activateNow ? 'Activate now' : 'Schedule activation',
      showBack: !activated,
    });
  }, [activateNow, validFrom, loading, activated]);

  if (activated || version?.status === 'ACTIVE') {
    return (
      <Panel title="Activation Complete">
        <div className="space-y-3 text-[13px]">
          <div className="flex items-center gap-2">
            <StatusBadge status="ACTIVE" />
            <span className="text-[var(--color-text-secondary)]">This version is now active.</span>
          </div>
          {version?.valid_from && (
            <p className="text-[var(--color-text-muted)]">Effective from: {version.valid_from}</p>
          )}
          <p className="text-[var(--color-text-secondary)]">The hierarchy creation workflow is complete.</p>
          <Button className="mt-2" onClick={() => navigate('/')}>Return to home</Button>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-[var(--color-text-muted)]">Version status:</span>
        <StatusBadge status={version?.status || 'APPROVED'} />
      </div>

      <Panel title="Activate Version" description="Activate this approved version immediately or schedule a future effective date.">
        <div className="space-y-4">
          <div className="flex gap-4 border-b border-[var(--color-border)] pb-3">
            <label className="flex items-center gap-2 text-[13px]">
              <input type="radio" checked={activateNow} onChange={() => setActivateNow(true)} />
              Activate immediately
            </label>
            <label className="flex items-center gap-2 text-[13px]">
              <input type="radio" checked={!activateNow} onChange={() => setActivateNow(false)} />
              Schedule future effective date
            </label>
          </div>

          {!activateNow && (
            <FormField label="Effective date" required hint="The version will become active on this date.">
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </FormField>
          )}

          <p className="text-xs text-[var(--color-text-muted)]">
            Activating will retire any currently active version for this hierarchy.
          </p>
        </div>
      </Panel>
    </div>
  );
}
