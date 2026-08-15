import { useEffect, useState } from 'react';
import Button from '../../../components/ui/Button';
import Panel from '../../../components/ui/Panel';
import StatusBadge from '../../../components/StatusBadge';
import Textarea from '../../../components/ui/Textarea';
import { useAuth } from '../../../hooks/useAuth';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { approvalService, versionService } from '../../../services';

export default function Step9Approve({ setActions }) {
  const { session, completeStep, updateSession } = useWorkflow();
  const { user } = useAuth();
  const { showToast } = useToast();
  const [version, setVersion] = useState(null);
  const [request, setRequest] = useState(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [verRes, reqRes] = await Promise.all([
      versionService.get(session.versionId),
      approvalService.list(),
    ]);
    setVersion(verRes.data);
    updateSession({ versionStatus: verRes.data.status });
    const match = reqRes.data.find((r) => r.hierarchy_version_id === session.versionId);
    setRequest(match || null);
  };

  useEffect(() => { load().catch(() => {}); }, [session.versionId]);

  const act = async (stepId, action) => {
    if (action === 'reject' && !comment.trim()) {
      showToast('Rejection comment is required', 'error');
      return;
    }
    setLoading(true);
    try {
      if (action === 'approve') await approvalService.approve(request.approval_request_id, stepId, { comment });
      else await approvalService.reject(request.approval_request_id, stepId, { comment });
      showToast(`Step ${action === 'approve' ? 'approved' : 'rejected'}`, action === 'approve' ? 'success' : 'error');
      setComment('');
      await load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = async () => {
    if (version?.status === 'REJECTED') {
      showToast('Version was rejected. Return to draft from the home page to revise.', 'error');
      return;
    }
    if (version?.status !== 'APPROVED') {
      showToast('All approval steps must be completed before continuing', 'error');
      return;
    }
    completeStep(9, { versionStatus: version.status });
  };

  useEffect(() => {
    setActions({
      onContinue: handleContinue,
      loading,
      continueDisabled: version?.status !== 'APPROVED',
      continueLabel: version?.status === 'APPROVED' ? 'Continue' : 'Awaiting approval',
    });
  }, [version, loading]);

  if (!request) {
    return (
      <Panel title="Approval">
        <p className="text-[13px] text-[var(--color-text-muted)]">No approval request found for this version.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-[13px]">
        <span className="text-[var(--color-text-muted)]">Version status:</span>
        <StatusBadge status={version?.status} />
      </div>

      <Panel title="Approval Workflow" description="Complete sequential approval steps. Each step must be approved in order.">
        <p className="mb-4 text-[13px] text-[var(--color-text-secondary)]">{request.submission_comment}</p>

        <div className="space-y-2">
          {request.steps.map((step) => {
            const canAct = step.status === 'PENDING'
              && (user.username === step.approver_role_or_user || user.role === step.approver_role_or_user);
            const isPending = step.status === 'PENDING';

            return (
              <div key={step.approval_step_id} className={`flex items-center justify-between rounded-[var(--radius-sm)] border px-3 py-2 ${isPending ? 'border-amber-200 bg-amber-50/50' : 'border-[var(--color-border)]'}`}>
                <div className="text-[13px]">
                  <span className="font-medium">Step {step.step_sequence}</span>
                  <span className="mx-2 text-[var(--color-text-muted)]">·</span>
                  {step.approver_role_or_user}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={step.status} />
                  {canAct && (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => act(step.approval_step_id, 'approve')} disabled={loading}>Approve</Button>
                      <Button size="sm" variant="danger" onClick={() => act(step.approval_step_id, 'reject')} disabled={loading}>Reject</Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {request.steps.some((s) => s.status === 'PENDING' && (user.username === s.approver_role_or_user || user.role === s.approver_role_or_user)) && (
          <div className="mt-4 border-t border-[var(--color-border)] pt-4">
            <label className="mb-1 block text-xs font-medium text-[var(--color-text-secondary)]">Comment</label>
            <Textarea rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Optional for approval, required for rejection" />
          </div>
        )}
      </Panel>
    </div>
  );
}
