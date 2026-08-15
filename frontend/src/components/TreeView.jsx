import { ChevronDown, ChevronRight, Copy, Edit, Plus, Trash2, Type } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

const TYPE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-violet-100 text-violet-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function typeColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return TYPE_COLORS[Math.abs(hash) % TYPE_COLORS.length];
}

function TreeNode({
  node,
  level,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onInlineEdit,
  readOnly,
  isLast,
  parentPath,
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.display_name);
  const inputRef = useRef(null);
  const hasChildren = node.children?.length > 0;
  const selected = selectedId === node.version_node_id;
  const isDraft = !!node.isDraft;

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    if (readOnly || isDraft) return;
    setEditValue(node.display_name);
    setEditing(true);
  };

  const commitEdit = () => {
    setEditing(false);
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== node.display_name) {
      onInlineEdit?.(node, trimmed);
    }
  };

  return (
    <div className="relative">
      {level > 0 && (
        <>
          <span
            className="pointer-events-none absolute border-l border-[var(--color-border-strong)]"
            style={{ left: `${(level - 1) * 20 + 18}px`, top: 0, bottom: isLast ? '50%' : 0 }}
          />
          <span
            className="pointer-events-none absolute border-t border-[var(--color-border-strong)]"
            style={{ left: `${(level - 1) * 20 + 18}px`, top: '18px', width: '14px' }}
          />
        </>
      )}

      <div
        className={`group relative mb-1 flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-[13px] transition-all ${
          isDraft
            ? 'border-dashed border-blue-300 bg-blue-50/70'
            : selected
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-sm'
              : 'border-transparent hover:border-[var(--color-border)] hover:bg-white hover:shadow-sm'
        }`}
        style={{ marginLeft: `${level * 20}px` }}
      >
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]"
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />) : <span className="inline-block w-3.5" />}
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="min-w-0 flex-1 rounded border border-[var(--color-accent)] bg-white px-2 py-0.5 text-[13px] outline-none ring-2 ring-[var(--color-accent-muted)]"
            />
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 text-left"
              onClick={() => !isDraft && onSelect(node)}
              onDoubleClick={startEdit}
            >
              <span className="block truncate font-medium text-[var(--color-text)]">{node.display_name}</span>
            </button>
          )}
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor(node.node_type_name)}`}>
            {node.node_type_name}
          </span>
          {isDraft && <span className="shrink-0 text-[10px] font-medium text-blue-600">Preview</span>}
        </div>

        {!readOnly && !isDraft && (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" title="Add child" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={() => onAdd(node)}>
              <Plus size={13} />
            </button>
            <button type="button" title="Edit" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={() => onEdit(node)}>
              <Edit size={13} />
            </button>
            <button type="button" title="Quick rename" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={startEdit}>
              <Type size={13} />
            </button>
            <button type="button" title="Clone" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]" onClick={() => onClone(node)}>
              <Copy size={13} />
            </button>
            <button type="button" title="Delete" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => onDelete(node)}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && node.children.map((child, idx) => (
        <TreeNode
          key={child.version_node_id}
          node={child}
          level={level + 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onClone={onClone}
          onInlineEdit={onInlineEdit}
          readOnly={readOnly}
          isLast={idx === node.children.length - 1}
          parentPath={[...parentPath, node.version_node_id]}
        />
      ))}
    </div>
  );
}

export default function TreeView({ tree, selectedId, onSelect, onAdd, onEdit, onDelete, onClone, onInlineEdit, readOnly }) {
  if (!tree?.length) {
    return (
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-6 text-center">
        <div className="mb-2 text-sm font-medium text-[var(--color-text-secondary)]">No hierarchy yet</div>
        <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
          Fill in the form on the left to add your first node. The tree will update here in real time.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[420px] rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-3">
      {tree.map((node, idx) => (
        <TreeNode
          key={node.version_node_id}
          node={node}
          level={0}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onClone={onClone}
          onInlineEdit={onInlineEdit}
          readOnly={readOnly}
          isLast={idx === tree.length - 1}
          parentPath={[]}
        />
      ))}
    </div>
  );
}
