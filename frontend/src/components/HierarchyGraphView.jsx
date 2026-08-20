import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Scan, X } from 'lucide-react';
import HierarchyGraphNode from './HierarchyGraphNode';
import { NODE_HEIGHT, NODE_WIDTH, treeToFlowElements } from '../utils/treeLayout';
import { findNode, isDescendant, subtreeFrom } from '../utils/treeUtils';

const nodeTypes = { hierarchyNode: HierarchyGraphNode };

// Generous hit-testing box so a drop target lights up before the cursor is exactly centered on it.
function findDropTarget(nodes, draggedId, position) {
  const cx = position.x + NODE_WIDTH / 2;
  const cy = position.y + NODE_HEIGHT / 2;

  let best = null;
  let bestDist = Infinity;

  for (const n of nodes) {
    if (n.id === draggedId) continue;
    const nx = n.position.x + NODE_WIDTH / 2;
    const ny = n.position.y + NODE_HEIGHT / 2;
    const withinX = cx >= n.position.x - 40 && cx <= n.position.x + NODE_WIDTH + 40;
    const withinY = cy >= n.position.y - 30 && cy <= n.position.y + NODE_HEIGHT + 70;
    if (!withinX || !withinY) continue;
    const dist = Math.hypot(cx - nx, cy - ny);
    if (dist < bestDist) {
      bestDist = dist;
      best = n.id;
    }
  }
  return best;
}

function GraphCanvas({
  tree,
  selectedId,
  readOnly,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onMove,
  canMoveNode,
  propertyDefsByType,
}) {
  const { fitView } = useReactFlow();
  const draggingRef = useRef(null);
  const canMoveNodeRef = useRef(canMoveNode);
  canMoveNodeRef.current = canMoveNode;
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges] = useEdgesState([]);
  const [dropTarget, setDropTarget] = useState(null); // { id, valid }
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [focusedId, setFocusedId] = useState(null);

  const onFocus = useCallback((node) => {
    setFocusedId((prev) => (prev === node.version_node_id ? null : node.version_node_id));
  }, []);

  // If the focused node disappears from the tree (deleted, undone, etc.) drop back to full view.
  useEffect(() => {
    if (focusedId && !findNode(tree, focusedId)) {
      setFocusedId(null);
    }
  }, [tree, focusedId]);

  const focusedNode = focusedId ? findNode(tree, focusedId) : null;
  const displayTree = useMemo(
    () => (focusedNode ? subtreeFrom(tree, focusedId) : tree),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tree, focusedId],
  );

  const callbacksRef = useRef({});
  callbacksRef.current = { selectedId, readOnly, onSelect, onAdd, onEdit, onDelete, onClone, onFocus, focusedId, propertyDefsByType };

  const buildLayout = useCallback(() => {
    const { selectedId: sel, readOnly: ro, onSelect: os, onAdd: oa, onEdit: oe, onDelete: od, onClone: oc, onFocus: of_, focusedId: fid, propertyDefsByType: pdt } = callbacksRef.current;
    return treeToFlowElements(displayTree, { selectedId: sel, readOnly: ro, onSelect: os, onAdd: oa, onEdit: oe, onDelete: od, onClone: oc, onFocus: of_, focusedId: fid, propertyDefsByType: pdt });
  }, [displayTree]);

  // Rebuild positions/edges only when the underlying tree structure actually changes.
  // Drag/hover state is applied separately below, WITHOUT touching node positions,
  // so React Flow's own drag tracking is never fought over mid-drag.
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = buildLayout();
    setNodes(newNodes);
    setEdges(newEdges);
    const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayTree]);

  // Push interaction flags (selection, drop target, dragging) onto existing node data
  // without ever overwriting `position`.
  useEffect(() => {
    setNodes((nds) => nds.map((n) => {
      const isDraggingNode = draggingNodeId === n.id;
      const isDropTarget = dropTarget?.id === n.id && dropTarget.valid;
      const isInvalidDropTarget = dropTarget?.id === n.id && !dropTarget.valid;
      return {
        ...n,
        zIndex: isDraggingNode ? 1000 : (isDropTarget || isInvalidDropTarget) ? 500 : 0,
        data: {
          ...n.data,
          selectedId,
          readOnly,
          isDropTarget,
          isInvalidDropTarget,
          isDraggingNode,
          isFocused: focusedId === n.id,
          onSelect,
          onAdd,
          onEdit,
          onDelete,
          onClone,
          onFocus,
        },
      };
    }));
  }, [selectedId, readOnly, dropTarget, draggingNodeId, focusedId, onSelect, onAdd, onEdit, onDelete, onClone, onFocus, setNodes]);

  const onNodeDragStart = useCallback((_, node) => {
    draggingRef.current = node.id;
    setDraggingNodeId(node.id);
  }, []);

  const evaluateDrop = useCallback((draggedId, targetId) => {
    if (!targetId || targetId === draggedId) {
      return { valid: false, reason: null };
    }
    if (isDescendant(tree, draggedId, targetId)) {
      return { valid: false, reason: "Can't move a node under its descendant" };
    }
    const check = canMoveNodeRef.current?.(draggedId, targetId, null);
    if (check && !check.valid) {
      return { valid: false, reason: check.reason };
    }
    return { valid: true, reason: null };
  }, [tree]);

  const onNodeDrag = useCallback((_, node) => {
    const targetId = findDropTarget(nodes, node.id, node.position);
    if (!targetId) {
      setDropTarget(null);
      return;
    }
    const { valid, reason } = evaluateDrop(node.id, targetId);
    setDropTarget((prev) => (
      prev?.id === targetId && prev?.valid === valid && prev?.reason === reason
        ? prev
        : { id: targetId, valid, reason }
    ));
  }, [nodes, evaluateDrop]);

  const onNodeDragStop = useCallback((_, node) => {
    const draggedId = draggingRef.current;
    draggingRef.current = null;
    setDraggingNodeId(null);
    setDropTarget(null);

    const targetId = findDropTarget(nodes, draggedId, node.position);
    const { valid } = evaluateDrop(draggedId, targetId);

    if (!readOnly && draggedId && onMove && targetId) {
      onMove(draggedId, targetId, null);
      if (!valid) {
        const { nodes: freshNodes } = buildLayout();
        setNodes(freshNodes);
      }
      return;
    }

    // No target: snap back to the last known-good layout.
    const { nodes: freshNodes } = buildLayout();
    setNodes(freshNodes);
  }, [nodes, readOnly, onMove, evaluateDrop, buildLayout, setNodes]);

  if (!tree?.length) {
    return (
      <div className="flex h-full min-h-[480px] flex-col items-center justify-center rounded-xl border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-8 text-center">
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-accent-muted)]">
          <svg className="h-6 w-6 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-[var(--color-text)]">Empty hierarchy</h3>
        <p className="mt-1 max-w-sm text-xs text-[var(--color-text-muted)]">
          Add nodes from the toolbar. Drag nodes in the graph to reorganize structure.
        </p>
        {!readOnly && (
          <button
            type="button"
            onClick={() => onAdd?.(null)}
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2 text-xs font-medium text-white hover:bg-[var(--color-accent-hover)]"
          >
            Add first node
          </button>
        )}
      </div>
    );
  }

  const targetLabel = dropTarget ? nodes.find((n) => n.id === dropTarget.id)?.data?.label : null;

  return (
    <div className={`relative h-full min-h-[480px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)] ${draggingNodeId ? 'cursor-grabbing' : ''}`}>
      {focusedNode && (
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50/95 px-3 py-1.5 text-xs font-medium text-indigo-700 shadow-sm backdrop-blur">
          <Scan size={12} />
          <span>Focused on "{focusedNode.display_name}"</span>
          <button
            type="button"
            title="Exit focused view"
            className="rounded-full p-0.5 text-indigo-500 hover:bg-indigo-100 hover:text-indigo-800"
            onClick={() => setFocusedId(null)}
          >
            <X size={12} />
          </button>
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable={!readOnly}
        nodesConnectable={false}
        elementsSelectable={!readOnly}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => (n.data?.isDropTarget ? '#22c55e' : n.data?.isDraft ? '#93c5fd' : '#2563eb')}
          maskColor="rgba(248, 249, 251, 0.85)"
          className="!rounded-md !border !border-[var(--color-border)]"
        />
      </ReactFlow>
      {!readOnly && (
        <div
          className={`pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] font-medium shadow-sm backdrop-blur transition-colors ${
            draggingNodeId
              ? dropTarget?.valid
                ? 'bg-emerald-600 text-white'
                : dropTarget && !dropTarget.valid
                  ? 'bg-red-600 text-white'
                  : 'bg-white/90 text-[var(--color-text-muted)]'
              : 'bg-white/90 text-[var(--color-text-muted)]'
          }`}
        >
          {draggingNodeId
            ? dropTarget?.valid
              ? `Release to move under "${targetLabel}"`
              : dropTarget && !dropTarget.valid
                ? (dropTarget.reason || "Can't drop here")
                : 'Drag onto a node to re-parent'
            : 'Drag a node onto another to re-parent'}
        </div>
      )}
    </div>
  );
}

export default function HierarchyGraphView(props) {
  return (
    <ReactFlowProvider>
      <div className="relative h-full">
        <GraphCanvas {...props} />
      </div>
    </ReactFlowProvider>
  );
}
