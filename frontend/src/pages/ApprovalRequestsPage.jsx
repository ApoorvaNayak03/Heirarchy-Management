import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { approvalService } from '../services';

export default function ApprovalRequestsPage() {
  const { showToast } = useToast();
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);

  const load = () => approvalService.list().then((res) => setRequests(res.data));
  useEffect(() => { load(); }, []);

  const act = async (requestId, stepId, action) => {
    const comment = action === 'reject' ? prompt('Rejection reason (required)') : prompt('Comment (optional)') || '';
    if (action === 'reject' && !comment) return;
    try {
      if (action === 'approve') await approvalService.approve(requestId, stepId, { comment });
      else await approvalService.reject(requestId, stepId, { comment });
      showToast(`Step ${action}d`, 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Action failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Approval Requests" subtitle="Sequential approval workflow" />
      <div className="space-y-4">
        {requests.length ? requests.map((req) => (
          <div key={req.approval_request_id} className="rounded-xl border bg-white p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <div className="font-semibold">{req.hierarchy_name} - {req.version_no}</div>
                <div className="text-sm text-slate-500">Submitted by {req.submitted_by}</div>
              </div>
              <StatusBadge status={req.status} />
            </div>
            <p className="mb-4 text-sm text-slate-600">{req.submission_comment}</p>
            <div className="space-y-2">
              {req.steps.map((step) => {
                const canAct = step.status === 'PENDING' && (user.username === step.approver_role_or_user || user.role === step.approver_role_or_user);
                return (
                  <div key={step.approval_step_id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                    <div>Step {step.step_sequence}: {step.approver_role_or_user}</div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={step.status} />
                      {canAct && (
                        <>
                          <button type="button" className="text-emerald-600" onClick={() => act(req.approval_request_id, step.approval_step_id, 'approve')}>Approve</button>
                          <button type="button" className="text-red-600" onClick={() => act(req.approval_request_id, step.approval_step_id, 'reject')}>Reject</button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )) : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-slate-500">No approval requests.</div>}
      </div>
    </div>
  );
}
