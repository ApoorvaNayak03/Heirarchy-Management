import { Network, TreePine } from 'lucide-react';

export default function ViewToggle({ view, onChange, nodeCount }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent-muted)] px-1.5 font-semibold text-[var(--color-accent)]">
          {nodeCount}
        </span>
        nodes
      </div>
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => onChange('tree')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            view === 'tree'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <TreePine size={14} /> Tree
        </button>
        <button
          type="button"
          onClick={() => onChange('graph')}
          className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            view === 'graph'
              ? 'bg-white text-[var(--color-text)] shadow-sm'
              : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Network size={14} /> Graph
        </button>
      </div>
    </div>
  );
}
