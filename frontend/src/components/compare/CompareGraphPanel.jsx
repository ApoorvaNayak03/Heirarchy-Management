import { useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, ReactFlowProvider, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { nodeDiffStyle } from '../../utils/compareUtils';
import { treeToFlowElements } from '../../utils/treeLayout';

function CompareGraphNode({ data }) {
  const { label, nodeType, diffClass } = data;
  return (
    <div className={`min-w-[160px] max-w-[200px] rounded-md border px-2.5 py-2 ${diffClass || 'border-[var(--color-border)] bg-white'}`}>
      <div className="truncate text-[12px] font-medium text-[var(--color-text)]">{label}</div>
      <div className="mt-0.5 truncate text-[10px] text-[var(--color-text-muted)]">{nodeType}</div>
    </div>
  );
}

const nodeTypes = { compareNode: CompareGraphNode };

function GraphCanvas({ tree, diffMap, side }) {
  const { fitView } = useReactFlow();

  const { nodes, edges } = useMemo(() => {
    const base = treeToFlowElements(tree, { readOnly: true });
    return {
      nodes: base.nodes.map((n) => ({
        ...n,
        type: 'compareNode',
        data: {
          label: n.data.label,
          nodeType: n.data.nodeType,
          diffClass: nodeDiffStyle(diffMap[n.data.node?.hierarchy_node_id] || [], side, 'graph'),
        },
      })),
      edges: base.edges,
    };
  }, [tree, diffMap, side]);

  useEffect(() => {
    if (nodes.length) {
      const t = setTimeout(() => fitView({ padding: 0.15, duration: 200 }), 50);
      return () => clearTimeout(t);
    }
  }, [nodes, fitView]);

  if (!tree?.length) {
    return <div className="flex h-full items-center justify-center text-xs text-[var(--color-text-muted)]">Empty</div>;
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      fitView
      fitViewOptions={{ padding: 0.15 }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} color="#e2e8f0" />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

export default function CompareGraphPanel({ label, tree, diffMap, side }) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2 text-xs font-medium text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="relative flex-1">
        <ReactFlowProvider>
          <GraphCanvas tree={tree} diffMap={diffMap} side={side} />
        </ReactFlowProvider>
      </div>
    </div>
  );
}
