import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Edit,
  GripVertical,
  Plus,
  Trash2,
  Type,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { isDescendant } from '../../utils/treeUtils';

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

function DropIndicator({ id, active }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`mx-2 h-1 rounded-full transition-all ${
        isOver && active ? 'bg-[var(--color-accent)] opacity-100' : 'opacity-0'
      }`}
    />
  );
}

function TreeNodeRow({
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
  dragActive,
  isDragging,
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.display_name);
  const inputRef = useRef(null);
  const hasChildren = node.children?.length > 0;
  const selected = selectedId === node.version_node_id;

  const { attributes, listeners, setNodeRef: setDragRef, transform, isDragging: selfDragging } = useDraggable({
    id: node.version_node_id,
    disabled: readOnly,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `on-${node.version_node_id}`,
    disabled: readOnly,
  });

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const startEdit = () => {
    if (readOnly) return;
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

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: selfDragging ? 0.4 : 1 }
    : undefined;

  return (
    <div className="relative">
      {level > 0 && (
        <>
          <span
            className="pointer-events-none absolute border-l border-[var(--color-border-strong)]"
            style={{ left: `${(level - 1) * 24 + 20}px`, top: 0, bottom: isLast ? '50%' : 0 }}
          />
          <span
            className="pointer-events-none absolute border-t border-[var(--color-border-strong)]"
            style={{ left: `${(level - 1) * 24 + 20}px`, top: '20px', width: '16px' }}
          />
        </>
      )}

      {!readOnly && <DropIndicator id={`before-${node.version_node_id}`} active={dragActive} />}

      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        style={{ ...style, marginLeft: `${level * 24}px` }}
        className={`group relative mb-0.5 flex items-center gap-1 rounded-lg border px-1.5 py-1.5 text-[13px] transition-all ${
          isOver && dragActive
            ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] ring-2 ring-[var(--color-accent)]/30'
            : selected
              ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] shadow-sm'
              : 'border-transparent hover:border-[var(--color-border)] hover:bg-white hover:shadow-sm'
        } ${isDragging ? 'opacity-50' : ''}`}
      >
        {!readOnly && (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-0.5 text-[var(--color-text-muted)] opacity-0 hover:bg-[var(--color-bg)] group-hover:opacity-100 active:cursor-grabbing"
            {...listeners}
            {...attributes}
          >
            <GripVertical size={14} />
          </button>
        )}

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
            <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onSelect(node)} onDoubleClick={startEdit}>
              <span className="block truncate font-medium text-[var(--color-text)]">{node.display_name}</span>
            </button>
          )}
          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${typeColor(node.node_type_name)}`}>
            {node.node_type_name}
          </span>
        </div>

        {!readOnly && (
          <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <button type="button" title="Add child" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" onClick={() => onAdd(node)}>
              <Plus size={13} />
            </button>
            <button type="button" title="Edit" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" onClick={() => onEdit(node)}>
              <Edit size={13} />
            </button>
            <button type="button" title="Rename" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" onClick={startEdit}>
              <Type size={13} />
            </button>
            <button type="button" title="Clone" className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)]" onClick={() => onClone(node)}>
              <Copy size={13} />
            </button>
            <button type="button" title="Delete" className="rounded p-1 text-red-500 hover:bg-red-50" onClick={() => onDelete(node)}>
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {expanded && hasChildren && node.children.map((child, idx) => (
        <TreeNodeRow
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
          dragActive={dragActive}
          isDragging={isDragging}
        />
      ))}

      {!readOnly && isLast && level === 0 && <DropIndicator id={`after-${node.version_node_id}`} active={dragActive} />}
    </div>
  );
}

function DragPreview({ node }) {
  if (!node) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-[var(--color-accent)] bg-white px-3 py-2 text-[13px] font-medium shadow-lg">
      <GripVertical size={14} className="text-[var(--color-text-muted)]" />
      {node.display_name}
      <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${typeColor(node.node_type_name)}`}>
        {node.node_type_name}
      </span>
    </div>
  );
}

function RootDropZone({ active, readOnly }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root-drop', disabled: readOnly });
  if (readOnly) return null;
  return (
    <div
      ref={setNodeRef}
      className={`mb-3 rounded-lg border-2 border-dashed px-4 py-3 text-center text-xs transition-all ${
        isOver && active
          ? 'border-[var(--color-accent)] bg-[var(--color-accent-muted)] text-[var(--color-accent)]'
          : 'border-[var(--color-border-strong)] text-[var(--color-text-muted)]'
      }`}
    >
      Drop here to make a root node
    </div>
  );
}

export default function DraggableTreeView({
  tree,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onInlineEdit,
  onMove,
  readOnly,
}) {
  const [activeId, setActiveId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
    const find = (nodes) => {
      for (const n of nodes || []) {
        if (n.version_node_id === event.active.id) return n;
        const c = find(n.children);
        if (c) return c;
      }
      return null;
    };
    setActiveNode(find(tree));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveNode(null);
    if (!over || !active) return;

    const draggedId = active.id;
    const overId = String(over.id);

    if (overId === 'root-drop') {
      onMove?.(draggedId, null, 0);
      return;
    }

    if (overId.startsWith('on-')) {
      const targetId = overId.slice(3);
      if (targetId !== draggedId && !isDescendant(tree, draggedId, targetId)) {
        onMove?.(draggedId, targetId, null);
      }
      return;
    }

    if (overId.startsWith('before-')) {
      const targetId = overId.slice(7);
      onMove?.(draggedId, targetId, 'before');
      return;
    }

    if (overId.startsWith('after-')) {
      const targetId = overId.slice(6);
      onMove?.(draggedId, targetId, 'after');
    }
  };

  if (!tree?.length) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)]">
          <Plus size={24} className="text-[var(--color-accent)]" />
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Empty hierarchy</h3>
        <p className="mt-1 max-w-sm text-xs text-[var(--color-text-muted)]">
          Click the button below or use the toolbar to add your first root node. Drag nodes to reorganize once added.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onAdd(null)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            <Plus size={14} /> Add first node
          </button>
        )}
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="h-full min-h-[480px] overflow-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] p-4">
        <RootDropZone active={!!activeId} readOnly={readOnly} />
        {tree.map((node, idx) => (
          <TreeNodeRow
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
            dragActive={!!activeId}
            isDragging={activeId === node.version_node_id}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={null}>
        <DragPreview node={activeNode} />
      </DragOverlay>
    </DndContext>
  );
}
