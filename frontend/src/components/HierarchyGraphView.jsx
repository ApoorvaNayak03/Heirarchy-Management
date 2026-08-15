import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import HierarchyGraphNode from './HierarchyGraphNode';
import { NODE_HEIGHT, NODE_WIDTH, treeToFlowElements } from '../utils/treeLayout';
import { isDescendant } from '../utils/treeUtils';

const nodeTypes = { hierarchyNode: HierarchyGraphNode };

function findDropTarget(nodes, draggedId, position) {
  const cx = position.x + NODE_WIDTH / 2;
  const cy = position.y + NODE_HEIGHT / 2;

  let best = null;
  let bestDist = Infinity;

  for (const n of nodes) {
    if (n.id === draggedId) continue;
    const nx = n.position.x + NODE_WIDTH / 2;
    const ny = n.position.y + NODE_HEIGHT / 2;
    const withinX = cx >= n.position.x - 20 && cx <= n.position.x + NODE_WIDTH + 20;
    const withinY = cy >= n.position.y - 10 && cy <= n.position.y + NODE_HEIGHT + 40;
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
  dropTargetId,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onClone,
  onMove,
}) {
  const { fitView, getNodes } = useReactFlow();
  const draggingRef = useRef(null);
  const [localDropTarget, setLocalDropTarget] = useState(null);
  const [resetToken, setResetToken] = useState(0);

  const { nodes, edges } = useMemo(
    () => treeToFlowElements(tree, {
      selectedId,
      readOnly,
      dropTargetId: localDropTarget || dropTargetId,
      onSelect,
      onAdd,
      onEdit,
      onDelete,
      onClone,
    }),
    [tree, selectedId, readOnly, localDropTarget, dropTargetId, onSelect, onAdd, onEdit, onDelete, onClone, resetToken],
  );

  useEffect(() => {
    if (nodes.length) {
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 300 }), 50);
      return () => clearTimeout(timer);
    }
  }, [nodes.length, edges.length, fitView]);

  const onNodeDragStart = useCallback((_, node) => {
    draggingRef.current = node.id;
  }, []);

  const onNodeDrag = useCallback((_, node) => {
    const currentNodes = getNodes();
    const target = findDropTarget(currentNodes, node.id, node.position);
    setLocalDropTarget(target);
  }, [getNodes]);

  const onNodeDragStop = useCallback((_, node) => {
    const draggedId = draggingRef.current;
    draggingRef.current = null;
    setLocalDropTarget(null);

    if (readOnly || !draggedId || !onMove) return;

    const currentNodes = getNodes();
    const targetId = findDropTarget(currentNodes, draggedId, node.position);

    if (targetId && targetId !== draggedId && !isDescendant(tree, draggedId, targetId)) {
      onMove(draggedId, targetId, null);
    } else {
      setResetToken((t) => t + 1);
    }
  }, [readOnly, onMove, tree, getNodes]);

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

  return (
    <div className="h-full min-h-[480px] overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-bg)]">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
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
        <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/90 px-4 py-1.5 text-[11px] text-[var(--color-text-muted)] shadow-sm backdrop-blur">
          Drag a node onto another to re-parent
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
