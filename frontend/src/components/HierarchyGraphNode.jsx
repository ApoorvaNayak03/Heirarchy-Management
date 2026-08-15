import { Copy, Edit, Plus, Trash2 } from 'lucide-react';
import { Handle, Position } from 'reactflow';

export default function HierarchyGraphNode({ data }) {
  const { label, nodeType, isDraft, node, selectedId, readOnly, isDropTarget, onSelect, onAdd, onEdit, onDelete, onClone } = data;
  const selected = selectedId === node.version_node_id;

  return (
    <div
      className={`group min-w-[180px] max-w-[220px] rounded-lg border-2 bg-white px-3 py-2.5 shadow-sm transition-all ${
        isDropTarget
          ? 'border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200'
          : isDraft
            ? 'border-dashed border-blue-300 bg-blue-50/80'
            : selected
              ? 'border-[var(--color-accent)] shadow-md ring-2 ring-[var(--color-accent-muted)]'
              : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] hover:shadow-md'
      }`}
      onClick={() => !isDraft && onSelect?.(node)}
      onKeyDown={(e) => e.key === 'Enter' && !isDraft && onSelect?.(node)}
      role="button"
      tabIndex={0}
    >
      <Handle type="target" position={Position.Top} className="!h-2 !w-2 !border-2 !border-slate-300 !bg-white" />
      <div className="truncate text-[13px] font-semibold text-[var(--color-text)]">{label || 'Untitled'}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <span className="truncate rounded bg-[var(--color-bg)] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
          {nodeType}
        </span>
        {isDraft && <span className="text-[10px] font-medium text-blue-600">Preview</span>}
      </div>
      {!readOnly && !isDraft && (
        <div className="mt-2 flex justify-end gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button type="button" title="Add child" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={(e) => { e.stopPropagation(); onAdd?.(node); }}>
            <Plus size={12} />
          </button>
          <button type="button" title="Edit" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={(e) => { e.stopPropagation(); onEdit?.(node); }}>
            <Edit size={12} />
          </button>
          <button type="button" title="Clone" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={(e) => { e.stopPropagation(); onClone?.(node); }}>
            <Copy size={12} />
          </button>
          <button type="button" title="Delete" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={(e) => { e.stopPropagation(); onDelete?.(node); }}>
            <Trash2 size={12} />
          </button>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="!h-2 !w-2 !border-2 !border-slate-300 !bg-white" />
    </div>
  );
}
