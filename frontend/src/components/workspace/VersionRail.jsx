import {
  CheckCircle2,
  Copy,
  GitBranch,
  GitCompare,
  GitMerge,
  Loader2,
  Play,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import StatusBadge from '../StatusBadge';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';

const EDITABLE = ['DRAFT', 'REJECTED'];

export default function VersionRail({
  hierarchy,
  hierarchyId,
  versions,
  version,
  onSelectVersion,
  onCreateVersion,
  onCopyVersion,
  onCancelVersion,
  onReturnToDraft,
  onValidate,
  onSubmit,
  onActivate,
  onMergeDraft,
  validationResult,
  loading,
}) {
  const [showCopy, setShowCopy] = useState(false);
  const [copyForm, setCopyForm] = useState({ version_no: '', version_name: '' });
  const [showSubmit, setShowSubmit] = useState(false);
  const [submitForm, setSubmitForm] = useState({
    comment: '',
    approval_steps: [{ step_sequence: 1, approver_role_or_user: 'Supply Chain Manager' }],
  });
  const [showActivate, setShowActivate] = useState(false);
  const [validFrom, setValidFrom] = useState(new Date().toISOString().slice(0, 10));

  const editable = version && EDITABLE.includes(version.status);

  const handleCopy = async () => {
    const source = versions.find((v) => v.hierarchy_version_id === version?.hierarchy_version_id)
      || versions.find((v) => v.status === 'ACTIVE')
      || versions[0];
    if (!source) return;
    await onCopyVersion(source.hierarchy_version_id, copyForm);
    setShowCopy(false);
    setCopyForm({ version_no: '', version_name: '' });
  };

  return (
    <aside className="relative flex w-64 shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] px-4 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Hierarchy</div>
        <h2 className="mt-1 truncate text-sm font-semibold text-[var(--color-text)]">{hierarchy?.name}</h2>
        <p className="mt-0.5 truncate font-mono text-[10px] text-[var(--color-text-muted)]">{hierarchy?.code}</p>
      </div>

      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Versions</span>
        <button
          type="button"
          title="New version"
          onClick={() => {
            const nextNo = versions.length + 1;
            setCopyForm({ version_no: `V${nextNo}`, version_name: `Version ${nextNo}` });
            setShowCopy(true);
          }}
          className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-accent)]"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {versions.map((v) => {
          const active = v.hierarchy_version_id === version?.hierarchy_version_id;
          return (
            <button
              key={v.hierarchy_version_id}
              type="button"
              onClick={() => onSelectVersion(v.hierarchy_version_id)}
              className={`mb-1 w-full rounded-lg border px-3 py-2.5 text-left transition-all ${
                active
                  ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-sm'
                  : 'border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-bg)]'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-[var(--color-text)]">{v.version_no}</span>
                <StatusBadge status={v.status} />
              </div>
              {v.version_name && (
                <p className="mt-0.5 truncate text-[11px] text-[var(--color-text-muted)]">{v.version_name}</p>
              )}
              {v.scope_root_hierarchy_node_id && (
                <p className="mt-0.5 flex items-center gap-1 truncate text-[10px] text-[var(--color-accent)]">
                  <GitBranch size={10} />
                  {v.merged_at ? 'Merged · ' : ''}{v.scope_root_node_name || 'Node draft'}
                </p>
              )}
            </button>
          );
        })}

        {!versions.length && (
          <button
            type="button"
            onClick={onCreateVersion}
            className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-[var(--color-border-strong)] px-3 py-6 text-center hover:border-[var(--color-accent)] hover:bg-[var(--color-accent-muted)]/50"
          >
            <GitBranch size={18} className="text-[var(--color-accent)]" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Create initial version</span>
          </button>
        )}
      </div>

      {versions.length > 1 && hierarchyId && (
        <div className="border-t border-[var(--color-border)] p-3">
          <Link
            to={`/hierarchies/${hierarchyId}/compare${version ? `?b=${version.hierarchy_version_id}` : ''}`}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--color-border)] bg-gradient-to-r from-indigo-50 to-violet-50 px-3 py-2.5 text-xs font-semibold text-indigo-700 transition-all hover:border-indigo-300 hover:shadow-sm"
          >
            <GitCompare size={14} /> Compare versions
          </Link>
        </div>
      )}

      {version && (
        <div className="space-y-2 border-t border-[var(--color-border)] p-3">
          {editable && (
            <>
              <Button size="sm" className="w-full" variant="secondary" onClick={onValidate} disabled={loading}>
                <ShieldCheck size={13} /> Validate
              </Button>
              {validationResult?.valid && (
                <Button size="sm" className="w-full" onClick={() => setShowSubmit(true)} disabled={loading}>
                  <Send size={13} /> Submit for approval
                </Button>
              )}
              {validationResult && !validationResult.valid && (
                <p className="text-center text-[10px] text-red-600">{validationResult.errors?.length} errors — fix before submit</p>
              )}
              <Button size="sm" className="w-full" variant="ghost" onClick={onCancelVersion} disabled={loading}>
                <XCircle size={13} /> Cancel draft
              </Button>
            </>
          )}

          {version.status === 'REJECTED' && (
            <Button size="sm" className="w-full" variant="secondary" onClick={onReturnToDraft} disabled={loading}>
              <RotateCcw size={13} /> Return to draft
            </Button>
          )}

          {version.status === 'APPROVED' && !version.scope_root_hierarchy_node_id && (
            <Button size="sm" className="w-full" onClick={() => setShowActivate(true)} disabled={loading}>
              <Play size={13} /> Activate
            </Button>
          )}

          {version.status === 'APPROVED' && version.scope_root_hierarchy_node_id && !version.merged_at && (
            <Button size="sm" className="w-full" onClick={onMergeDraft} disabled={loading}>
              <GitMerge size={13} /> Merge into active
            </Button>
          )}

          {version.status === 'APPROVED' && version.scope_root_hierarchy_node_id && version.merged_at && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 size={13} /> Merged
            </div>
          )}

          {version.status === 'ACTIVE' && (
            <div className="flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] font-medium text-emerald-700">
              <CheckCircle2 size={13} /> Currently active
            </div>
          )}

          {version.status === 'PENDING_APPROVAL' && (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-center text-[11px] text-amber-800">
              Awaiting approval — read only
            </div>
          )}
        </div>
      )}

      {showCopy && (
        <div className="absolute inset-y-0 left-full z-30 w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <h3 className="text-sm font-semibold"><Copy size={14} className="mr-1 inline" /> New version</h3>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Copy structure from an existing version</p>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">Version number</label>
              <Input className="mt-1" value={copyForm.version_no} onChange={(e) => setCopyForm({ ...copyForm, version_no: e.target.value })} />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--color-text-secondary)]">Version name</label>
              <Input className="mt-1" value={copyForm.version_name} onChange={(e) => setCopyForm({ ...copyForm, version_name: e.target.value })} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setShowCopy(false)}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={handleCopy} disabled={!copyForm.version_no.trim()}>Create</Button>
            </div>
          </div>
        </div>
      )}

      {showSubmit && (
        <div className="absolute inset-y-0 left-full z-30 w-80 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <h3 className="text-sm font-semibold"><Send size={14} className="mr-1 inline" /> Submit for approval</h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium">Comment</label>
              <Textarea className="mt-1" rows={3} value={submitForm.comment} onChange={(e) => setSubmitForm({ ...submitForm, comment: e.target.value })} />
            </div>
            {submitForm.approval_steps.map((step, idx) => (
              <div key={idx}>
                <label className="text-[11px] font-medium">Step {step.step_sequence} approver</label>
                <Input
                  className="mt-1"
                  value={step.approver_role_or_user}
                  onChange={(e) => {
                    const steps = [...submitForm.approval_steps];
                    steps[idx] = { ...step, approver_role_or_user: e.target.value };
                    setSubmitForm({ ...submitForm, approval_steps: steps });
                  }}
                />
              </div>
            ))}
            <button
              type="button"
              className="text-xs text-[var(--color-accent)] hover:underline"
              onClick={() => setSubmitForm({
                ...submitForm,
                approval_steps: [...submitForm.approval_steps, { step_sequence: submitForm.approval_steps.length + 1, approver_role_or_user: '' }],
              })}
            >
              + Add approval step
            </button>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setShowSubmit(false)}>Cancel</Button>
              <Button
                size="sm"
                className="flex-1"
                onClick={async () => {
                  await onSubmit(submitForm);
                  setShowSubmit(false);
                }}
                disabled={!submitForm.comment.trim()}
              >
                Submit
              </Button>
            </div>
          </div>
        </div>
      )}

      {showActivate && (
        <div className="absolute inset-y-0 left-full z-30 w-72 border-r border-[var(--color-border)] bg-[var(--color-surface)] p-4 shadow-xl">
          <h3 className="text-sm font-semibold"><Play size={14} className="mr-1 inline" /> Activate version</h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className="text-[11px] font-medium">Effective from</label>
              <Input type="date" className="mt-1" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => setShowActivate(false)}>Cancel</Button>
              <Button size="sm" className="flex-1" onClick={async () => { await onActivate({ valid_from: validFrom }); setShowActivate(false); }}>Activate</Button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/60">
          <Loader2 size={24} className="animate-spin text-[var(--color-accent)]" />
        </div>
      )}
    </aside>
  );
}
