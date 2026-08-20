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
  CloudUpload,
  Copy,
  Edit,
  Filter,
  Folder,
  GitBranch,
  Info,
  LayoutGrid,
  MoreHorizontal,
  Plus,
  Search,
  Sigma,
  Trash2,
  Type,
  User,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { countNodes, isDescendant } from '../../utils/treeUtils';
import { nodeTypeColorClass } from '../../utils/nodeDisplay';
import {
  collectNodeTypes,
  filterTreeByTypes,
  getNodeTableCells,
} from '../../utils/treeTableDisplay';
import Button from '../ui/Button';

const ROW_GRID = 'grid grid-cols-[minmax(160px,auto)_minmax(0,1fr)_80px_32px] items-center gap-x-3 gap-y-1';

function typeIconStyle(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const palettes = [
    { bg: 'bg-amber-100', text: 'text-amber-600' },
    { bg: 'bg-rose-100', text: 'text-rose-500' },
    { bg: 'bg-cyan-100', text: 'text-cyan-600' },
    { bg: 'bg-violet-100', text: 'text-violet-600' },
    { bg: 'bg-emerald-100', text: 'text-emerald-600' },
    { bg: 'bg-blue-100', text: 'text-blue-600' },
  ];
  return palettes[Math.abs(hash) % palettes.length];
}

function typeDotColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const dots = ['bg-amber-400', 'bg-rose-400', 'bg-cyan-500', 'bg-violet-500', 'bg-emerald-500', 'bg-blue-500'];
  return dots[Math.abs(hash) % dots.length];
}

function FieldChip({ label, value, isCustom }) {
  return (
    <span
      title={`${label}: ${value}`}
      className={`inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${
        isCustom
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <span className={`truncate ${isCustom ? 'text-amber-700' : 'text-slate-500'}`}>{label}</span>
      <span className={`shrink-0 font-semibold tabular-nums ${isCustom ? 'text-amber-900' : 'text-slate-800'}`}>
        {value}
      </span>
    </span>
  );
}

function RollupChip({ label, value, aggregation, source }) {
  const shortLabel = label.replace(/^total\s+/i, '').trim() || label;
  return (
    <span
      title={`Rollup · ${aggregation} of ${source}`}
      className="inline-flex max-w-full items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[11px]"
    >
      <Sigma size={10} className="shrink-0 text-violet-600" />
      <span className="truncate text-violet-600">{shortLabel}</span>
      <span className="shrink-0 font-semibold tabular-nums text-violet-900">{value}</span>
    </span>
  );
}

function InlineNodeMeta({ fields, rollups }) {
  if (!fields.length && !rollups.length) {
    return <span className="text-[11px] italic text-slate-300">No fields</span>;
  }

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1.5">
      {fields.map((field) => (
        <FieldChip
          key={field.key}
          label={field.label}
          value={field.value}
          isCustom={field.isCustom}
        />
      ))}
      {rollups.map((rollup) => (
        <RollupChip
          key={rollup.key}
          label={rollup.label}
          value={rollup.value}
          aggregation={rollup.aggregation}
          source={rollup.source}
        />
      ))}
    </span>
  );
}

function TableHeaderRow() {
  return (
    <div className={`${ROW_GRID} sticky top-0 z-10 border-b border-slate-200 bg-slate-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400`}>
      <span>Name</span>
      <span>Fields & rollups</span>
      <span>Type</span>
      <span />
    </div>
  );
}

function DropIndicator({ id, active, invalid }) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div
      ref={setNodeRef}
      className={`col-span-3 h-1 rounded-full transition-all ${
        isOver && active
          ? invalid
            ? 'bg-red-400 opacity-100'
            : 'bg-violet-500 opacity-100'
          : 'opacity-0'
      }`}
    />
  );
}

function NodeActionMenu({ node, readOnly, onAdd, onEdit, onClone, onBranch, onDelete, onRename }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div ref={ref} className="relative flex justify-end">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        aria-label="Node actions"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-30 mt-1 min-w-[160px] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
          {!readOnly && (
            <>
              <MenuItem icon={Plus} label="Add child" onClick={() => { onAdd?.(node); setOpen(false); }} />
              <MenuItem icon={Edit} label="Edit" onClick={() => { onEdit?.(node); setOpen(false); }} />
              <MenuItem icon={Type} label="Rename" onClick={() => { onRename?.(); setOpen(false); }} />
              <MenuItem icon={Copy} label="Clone" onClick={() => { onClone?.(node); setOpen(false); }} />
              {onBranch && (
                <MenuItem icon={GitBranch} label="Branch draft" onClick={() => { onBranch?.(node); setOpen(false); }} />
              )}
              <div className="my-1 border-t border-slate-100" />
              <MenuItem icon={Trash2} label="Remove" danger onClick={() => { onDelete?.(node); setOpen(false); }} />
            </>
          )}
          {readOnly && (
            <MenuItem icon={Edit} label="View details" onClick={() => { onEdit?.(node); setOpen(false); }} />
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({ icon: Icon, label, onClick, danger }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] ${
        danger ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
      }`}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

function TreeTableRow({
  node,
  level,
  isLast,
  selectedId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onInlineEdit,
  onBranch,
  readOnly,
  dragActive,
  isDragging,
  canMoveNode,
  activeDragId,
  propertyDefsByType,
}) {
  const [expanded, setExpanded] = useState(level < 2);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(node.display_name);
  const inputRef = useRef(null);

  const hasChildren = node.children?.length > 0;
  const selected = selectedId === node.version_node_id;
  const propertyDefs = propertyDefsByType?.[node.node_type_id] || [];
  const { rollups, fields } = getNodeTableCells(node, propertyDefs);
  const iconStyle = typeIconStyle(node.node_type_name);
  const NodeIcon = hasChildren ? Folder : User;

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

  const dropAsChildValid = activeDragId && canMoveNode
    ? canMoveNode(activeDragId, node.version_node_id, null).valid
    : true;
  const dropBeforeValid = activeDragId && canMoveNode
    ? canMoveNode(activeDragId, node.version_node_id, 'before').valid
    : true;

  const style = transform
    ? { transform: CSS.Translate.toString(transform), opacity: selfDragging ? 0.4 : 1 }
    : undefined;

  const indent = 12 + level * 28;

  return (
    <div className="relative">
      {!readOnly && (
        <div className={`${ROW_GRID} px-4`}>
          <DropIndicator id={`before-${node.version_node_id}`} active={dragActive} invalid={!dropBeforeValid} />
        </div>
      )}

      <div
        ref={(el) => {
          setDragRef(el);
          setDropRef(el);
        }}
        style={style}
        className={`group ${ROW_GRID} relative border-b border-slate-100 px-4 py-2 text-[13px] transition-colors ${
          isOver && dragActive
            ? dropAsChildValid
              ? 'bg-violet-50 ring-1 ring-inset ring-violet-200'
              : 'bg-red-50 ring-1 ring-inset ring-red-200'
            : selected
              ? 'bg-violet-50/80 ring-1 ring-inset ring-violet-100'
              : 'hover:bg-slate-50/80'
        } ${isDragging ? 'opacity-50' : ''}`}
        onClick={() => onSelect(node)}
        onKeyDown={(e) => e.key === 'Enter' && onSelect(node)}
        role="row"
        tabIndex={0}
      >
        {level > 0 && (
          <>
            <span
              className="pointer-events-none absolute border-l border-slate-200"
              style={{ left: `${indent - 20}px`, top: 0, bottom: isLast && !expanded ? '50%' : 0 }}
            />
            <span
              className="pointer-events-none absolute border-t border-slate-200"
              style={{ left: `${indent - 20}px`, top: '50%', width: '14px' }}
            />
          </>
        )}

        {selected && (
          <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-violet-500" />
        )}

        {/* Name column */}
        <div className="flex min-w-0 items-center gap-1.5" style={{ paddingLeft: `${indent}px` }}>
          {!readOnly && (
            <button
              type="button"
              className="cursor-grab touch-none rounded p-0.5 text-slate-300 opacity-0 hover:text-slate-500 group-hover:opacity-100 active:cursor-grabbing"
              onClick={(e) => e.stopPropagation()}
              {...listeners}
              {...attributes}
            >
              <span className="inline-block h-3 w-1 rounded-full bg-current" />
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) setExpanded(!expanded);
            }}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100"
          >
            {hasChildren ? (
              expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />
            ) : (
              <span className="inline-block w-[15px]" />
            )}
          </button>

          <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${iconStyle.bg}`}>
            <NodeIcon size={14} className={iconStyle.text} />
          </span>

          {editing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={commitEdit}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitEdit();
                if (e.key === 'Escape') setEditing(false);
              }}
              className="min-w-0 flex-1 rounded border border-violet-300 bg-white px-2 py-0.5 text-[13px] outline-none ring-2 ring-violet-100"
            />
          ) : (
            <span className="truncate font-medium text-slate-800">{node.display_name}</span>
          )}
        </div>

        {/* Fields & rollups column */}
        <div className="min-w-0 py-0.5">
          {!editing && <InlineNodeMeta fields={fields} rollups={rollups} />}
        </div>

        {/* Type column */}
        <div className="flex justify-end">
          <span
            className={`inline-flex rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${nodeTypeColorClass(node.node_type_name)}`}
          >
            {node.node_type_name}
          </span>
        </div>

        {/* Actions column */}
        <div onClick={(e) => e.stopPropagation()} role="presentation">
          <NodeActionMenu
            node={node}
            readOnly={readOnly}
            onAdd={onAdd}
            onEdit={onEdit}
            onClone={onClone}
            onBranch={onBranch}
            onDelete={onDelete}
            onRename={startEdit}
          />
        </div>
      </div>

      {expanded && hasChildren && node.children.map((child, idx) => (
        <TreeTableRow
          key={child.version_node_id}
          node={child}
          level={level + 1}
          isLast={idx === node.children.length - 1}
          selectedId={selectedId}
          onSelect={onSelect}
          onAdd={onAdd}
          onEdit={onEdit}
          onDelete={onDelete}
          onClone={onClone}
          onInlineEdit={onInlineEdit}
          onBranch={onBranch}
          readOnly={readOnly}
          dragActive={dragActive}
          isDragging={isDragging}
          canMoveNode={canMoveNode}
          activeDragId={activeDragId}
          propertyDefsByType={propertyDefsByType}
        />
      ))}

      {!readOnly && isLast && level === 0 && (
        <div className={`${ROW_GRID} px-4`}>
          <DropIndicator
            id={`after-${node.version_node_id}`}
            active={dragActive}
            invalid={activeDragId && canMoveNode ? !canMoveNode(activeDragId, node.version_node_id, 'after').valid : false}
          />
        </div>
      )}
    </div>
  );
}

function DragPreview({ node }) {
  if (!node) return null;
  return (
    <div className="flex items-center gap-2 rounded-lg border border-violet-300 bg-white px-3 py-2 text-[13px] font-medium shadow-lg">
      {node.display_name}
    </div>
  );
}

function RootDropZone({ active, readOnly, invalid }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'root-drop', disabled: readOnly });
  if (readOnly) return null;

  return (
    <div
      ref={setNodeRef}
      className={`mb-4 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-5 text-[13px] transition-all ${
        isOver && active
          ? invalid
            ? 'border-red-300 bg-red-50 text-red-600'
            : 'border-violet-400 bg-violet-50 text-violet-700'
          : 'border-slate-200 bg-slate-50/50 text-slate-500'
      }`}
    >
      <CloudUpload size={18} className="shrink-0 opacity-70" />
      {isOver && active && invalid
        ? "Can't drop here — not allowed as root"
        : 'Drag and drop here to make a root node'}
    </div>
  );
}

function HierarchyCardHeader({
  search,
  onSearchChange,
  typeFilterOpen,
  onToggleFilter,
  filterPanel,
  onSwitchView,
  onAdd,
  readOnly,
}) {
  return (
    <div className="border-b border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Hierarchy</h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search nodes..."
              value={search}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="h-8 w-44 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-700 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            />
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={onToggleFilter}
              className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors ${
                typeFilterOpen
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter size={14} />
              Filter
            </button>
            {filterPanel}
          </div>

          {onSwitchView && (
            <button
              type="button"
              onClick={onSwitchView}
              title="Switch to graph view"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            >
              <LayoutGrid size={15} />
            </button>
          )}

          {!readOnly && (
            <Button size="sm" onClick={() => onAdd?.(null)} className="bg-violet-600 hover:bg-violet-700">
              <Plus size={14} /> Add Node
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function HierarchyCardFooter({ nodeCount, nodeTypes }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-2.5 text-[11px] text-slate-500">
      <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="inline-flex items-center gap-1.5">
          <Info size={13} className="text-slate-400" />
          Showing {nodeCount} node{nodeCount === 1 ? '' : 's'}
        </span>
        <span className="hidden h-3 w-px bg-slate-200 sm:inline" />
        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5">
          <span className="text-slate-500">Field</span>
          <span className="font-semibold text-slate-800">value</span>
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-1.5 py-0.5">
          <Sigma size={9} className="text-violet-600" />
          <span className="text-violet-600">Rollup</span>
          <span className="font-semibold text-violet-900">value</span>
        </span>
      </span>
      {nodeTypes.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          {nodeTypes.map(({ id, name }) => (
            <span key={id} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${typeDotColor(name)}`} />
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TypeFilterPanel({ nodeTypes, selectedTypes, onToggle, onClear }) {
  return (
    <div className="absolute right-0 top-full z-20 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
      <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Node type</div>
      {nodeTypes.map(({ id, name }) => (
        <label key={id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-slate-50">
          <input
            type="checkbox"
            checked={selectedTypes.has(id)}
            onChange={() => onToggle(id)}
            className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
          />
          <span className={`h-2 w-2 rounded-full ${typeDotColor(name)}`} />
          {name}
        </label>
      ))}
      {selectedTypes.size > 0 && (
        <button
          type="button"
          onClick={onClear}
          className="mt-1 w-full rounded px-2 py-1 text-left text-[12px] text-violet-600 hover:bg-violet-50"
        >
          Clear filter
        </button>
      )}
    </div>
  );
}

export default function DraggableTreeView({
  tree,
  fullTree,
  selectedId,
  search = '',
  onSearchChange,
  onSwitchView,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onInlineEdit,
  onBranch,
  onMove,
  canMoveNode,
  readOnly,
  propertyDefsByType,
}) {
  const [activeId, setActiveId] = useState(null);
  const [activeNode, setActiveNode] = useState(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState(() => new Set());

  const sourceTree = fullTree || tree;
  const filteredTree = useMemo(
    () => filterTreeByTypes(tree, selectedTypes),
    [tree, selectedTypes],
  );
  const totalNodes = useMemo(() => countNodes(filteredTree), [filteredTree]);
  const nodeTypes = useMemo(() => collectNodeTypes(sourceTree), [sourceTree]);

  const rootDropInvalid = activeId && canMoveNode ? !canMoveNode(activeId, null, null).valid : false;

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
    setActiveNode(find(filteredTree));
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    setActiveNode(null);
    if (!over || !active) return;

    const draggedId = active.id;
    const overId = String(over.id);

    if (overId === 'root-drop') {
      onMove?.(draggedId, null, null);
      return;
    }

    if (overId.startsWith('on-')) {
      const targetId = overId.slice(3);
      if (targetId !== draggedId && !isDescendant(filteredTree, draggedId, targetId)) {
        onMove?.(draggedId, targetId, null);
      }
      return;
    }

    if (overId.startsWith('before-')) {
      onMove?.(draggedId, overId.slice(7), 'before');
      return;
    }

    if (overId.startsWith('after-')) {
      onMove?.(draggedId, overId.slice(6), 'after');
    }
  };

  const toggleType = (id) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (!filteredTree?.length) {
    return (
      <div className="flex h-full min-h-[480px] flex-col">
        <RootDropZone active={!!activeId} readOnly={readOnly} invalid={rootDropInvalid} />
        <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <HierarchyCardHeader
            search={search}
            onSearchChange={onSearchChange}
            typeFilterOpen={filterOpen}
            onToggleFilter={() => setFilterOpen((v) => !v)}
            filterPanel={filterOpen && (
              <TypeFilterPanel
                nodeTypes={nodeTypes}
                selectedTypes={selectedTypes}
                onToggle={toggleType}
                onClear={() => setSelectedTypes(new Set())}
              />
            )}
            onSwitchView={onSwitchView}
            onAdd={onAdd}
            readOnly={readOnly}
          />
          <div className="flex flex-1 flex-col items-center justify-center px-8 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50">
              <Plus size={24} className="text-violet-600" />
            </div>
            <h3 className="text-sm font-semibold text-slate-800">
              {search || selectedTypes.size ? 'No matching nodes' : 'Empty hierarchy'}
            </h3>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              {search || selectedTypes.size
                ? 'Try adjusting your search or filter.'
                : 'Add your first root node to get started.'}
            </p>
            {!readOnly && !search && !selectedTypes.size && (
              <Button size="sm" className="mt-5 bg-violet-600 hover:bg-violet-700" onClick={() => onAdd?.(null)}>
                <Plus size={14} /> Add Node
              </Button>
            )}
          </div>
          <HierarchyCardFooter nodeCount={0} nodeTypes={nodeTypes} />
        </div>
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
      <div className="flex h-full min-h-[480px] flex-col">
        <RootDropZone active={!!activeId} readOnly={readOnly} invalid={rootDropInvalid} />

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <HierarchyCardHeader
            search={search}
            onSearchChange={onSearchChange}
            typeFilterOpen={filterOpen}
            onToggleFilter={() => setFilterOpen((v) => !v)}
            filterPanel={filterOpen && (
              <TypeFilterPanel
                nodeTypes={nodeTypes}
                selectedTypes={selectedTypes}
                onToggle={toggleType}
                onClear={() => setSelectedTypes(new Set())}
              />
            )}
            onSwitchView={onSwitchView}
            onAdd={onAdd}
            readOnly={readOnly}
          />

          <div className="min-h-0 flex-1 overflow-auto">
            <TableHeaderRow />
            {filteredTree.map((node, idx) => (
              <TreeTableRow
                key={node.version_node_id}
                node={node}
                level={0}
                isLast={idx === filteredTree.length - 1}
                selectedId={selectedId}
                onSelect={onSelect}
                onAdd={onAdd}
                onEdit={onEdit}
                onDelete={onDelete}
                onClone={onClone}
                onInlineEdit={onInlineEdit}
                onBranch={onBranch}
                readOnly={readOnly}
                dragActive={!!activeId}
                isDragging={activeId === node.version_node_id}
                canMoveNode={canMoveNode}
                activeDragId={activeId}
                propertyDefsByType={propertyDefsByType}
              />
            ))}
          </div>

          <HierarchyCardFooter nodeCount={totalNodes} nodeTypes={nodeTypes} />
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        <DragPreview node={activeNode} />
      </DragOverlay>
    </DndContext>
  );
}
