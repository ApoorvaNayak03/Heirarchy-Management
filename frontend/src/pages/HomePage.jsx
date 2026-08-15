import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronRight, GitBranch, Plus, Sparkles } from 'lucide-react';
import Button from '../components/ui/Button';
import StatusBadge from '../components/StatusBadge';
import { hierarchyService } from '../services';

export default function HomePage() {
  const navigate = useNavigate();
  const [hierarchies, setHierarchies] = useState([]);
  const [details, setDetails] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    hierarchyService.list()
      .then((res) => setHierarchies(res.data))
      .catch(() => setHierarchies([]))
      .finally(() => setLoading(false));
  }, []);

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
      <header className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)]">
          <GitBranch size={22} className="text-[var(--color-accent)]" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-text)]">Hierarchy Management</h1>
        <p className="mx-auto mt-2 max-w-lg text-[13px] text-[var(--color-text-secondary)]">
          Build, version, and govern supply chain hierarchies with a visual tree and graph workspace.
          Drag nodes to reorganize, create versions, and manage approvals — all from one canvas.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Button size="lg" onClick={() => navigate('/new')}>
            <Plus size={16} /> Create hierarchy
          </Button>
        </div>
      </header>

      {hierarchies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface)] px-8 py-16 text-center">
          <Sparkles size={28} className="mx-auto text-[var(--color-text-muted)]" />
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
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Your hierarchies</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {hierarchies.map((h) => {
              const d = details[h.hierarchy_id];
              return (
                <Link
                  key={h.hierarchy_id}
                  to={`/hierarchies/${h.hierarchy_id}`}
                  className="group flex items-center justify-between rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] px-5 py-4 shadow-sm transition-all hover:border-[var(--color-accent)] hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-sm font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)]">
                        {h.name}
                      </h3>
                      <StatusBadge status={h.status} />
                    </div>
                    <p className="mt-0.5 font-mono text-[11px] text-[var(--color-text-muted)]">{h.code}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-[var(--color-text-secondary)]">
                      {d?.active_version && (
                        <span className="rounded bg-emerald-50 px-2 py-0.5 text-emerald-700">
                          Active: {d.active_version.version_no}
                        </span>
                      )}
                      {d?.latest_draft && (
                        <span className="rounded bg-blue-50 px-2 py-0.5 text-blue-700">
                          Draft: {d.latest_draft.version_no}
                        </span>
                      )}
                      {d?.versions && (
                        <span>{d.versions.length} version{d.versions.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight size={18} className="shrink-0 text-[var(--color-text-muted)] transition-transform group-hover:translate-x-0.5 group-hover:text-[var(--color-accent)]" />
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
