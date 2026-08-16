import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, GitBranch, Plus, Sparkles, Trash2 } from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyService } from '../services';

export default function HomePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [hierarchies, setHierarchies] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hierarchyService.list()
      .then((res) => setHierarchies(res.data))
      .catch(() => setHierarchies([]))
      .finally(() => setLoading(false));
  }, []);

  const removeHierarchy = async (id) => {
    if (!window.confirm('Delete this hierarchy? This cannot be undone.')) return;
    try {
      await hierarchyService.delete(id);
      showToast('Hierarchy deleted', 'success');
      setHierarchies((prev) => prev.filter((h) => h.hierarchy_id !== id));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  useEffect(() => {
    hierarchies.forEach((h) => {
      hierarchyService.detail(h.hierarchy_id).then((res) => {
        setDetails((prev) => ({ ...prev, [h.hierarchy_id]: res.data }));
      }).catch(() => {});
    });
  }, [hierarchies]);

  if (loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-[13px] text-[var(--color-text-muted)]">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <header
        className="relative mb-10 overflow-hidden rounded-3xl border border-[var(--color-border)] px-8 py-14 text-center"
        style={{ background: 'linear-gradient(180deg, var(--color-hero-from) 0%, var(--color-hero-to) 100%)' }}
      >
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-64 w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: 'radial-gradient(closest-side, var(--color-accent-muted), transparent)' }}
        />
        <div className="relative mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[var(--shadow-card)] ring-1 ring-[var(--color-border)]">
          <GitBranch size={24} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="relative text-[28px] font-semibold tracking-tight text-[var(--color-text)]">Hierarchy Management</h1>
        <p className="relative mx-auto mt-3 max-w-lg text-[13px] text-[var(--color-text-secondary)]">
          Build, version, and govern supply chain hierarchies with a visual tree and graph workspace.
          Drag nodes to reorganize, create versions, and manage approvals — all from one canvas.
        </p>
        <div className="relative mt-7 flex justify-center gap-3">
          <Button size="lg" onClick={() => navigate('/new')}>
            <Plus size={16} /> Create hierarchy
          </Button>
        </div>
      </header>

      {hierarchies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-8 py-16 text-center shadow-[var(--shadow-card)]">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)]">
            <Sparkles size={22} className="text-[var(--color-accent)]" />
          </div>
          <h2 className="mt-4 text-sm font-medium text-[var(--color-text)]">No hierarchies yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-[13px] text-[var(--color-text-muted)]">
            Create your first hierarchy to open the visual workspace. Define node types, build the tree, and manage versions interactively.
          </p>
          <Button className="mt-6" onClick={() => navigate('/new')}>
            <Plus size={14} /> Get started
          </Button>
        </div>
      ) : (
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Your hierarchies</h2>
            <span className="text-[11px] text-[var(--color-text-muted)]">{hierarchies.length} total</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {hierarchies.map((h) => {
              const d = details[h.hierarchy_id];
              const initial = h.name?.trim()?.[0]?.toUpperCase() || '?';
              return (
                <div
                  key={h.hierarchy_id}
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/hierarchies/${h.hierarchy_id}`)}
                  onKeyDown={(e) => { if (e.key === 'Enter') navigate(`/hierarchies/${h.hierarchy_id}`); }}
                  className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-[var(--shadow-card)] transition-all duration-150 hover:-translate-y-0.5 hover:border-[var(--color-accent)] hover:shadow-[var(--shadow-card-hover)]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-sm font-semibold text-[var(--color-accent)]">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                        {h.name}
                      </h3>
                      <StatusBadge status={h.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">{h.code}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--color-text-secondary)]">
                      {d?.active_version && (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
                          Active: {d.active_version.version_no}
                        </span>
                      )}
                      {d?.latest_draft && (
                        <span className="rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          Draft: {d.latest_draft.version_no}
                        </span>
                      )}
                      {d?.versions && (
                        <span>{d.versions.length} version{d.versions.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeHierarchy(h.hierarchy_id); }}
                    className="shrink-0 rounded-lg p-1.5 text-[var(--color-text-muted)] transition-colors hover:bg-red-50 hover:text-red-600"
                    aria-label="Delete hierarchy"
                  >
                    <Trash2 size={16} />
                  </button>
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
