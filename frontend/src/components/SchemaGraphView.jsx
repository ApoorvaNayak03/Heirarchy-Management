import { useEffect, useMemo } from 'react';
import ReactFlow, { Background, Controls, MiniMap, ReactFlowProvider, useReactFlow } from 'reactflow';
import 'reactflow/dist/style.css';
import { schemaGraphElements } from '../utils/schemaPreview';

function SchemaGraphNode({ data }) {
  return (
    <div
      className={`min-w-[160px] rounded-lg border-2 px-3 py-2 text-center shadow-sm ${
        data.isDraft
          ? 'border-dashed border-blue-300 bg-blue-50'
          : 'border-[var(--color-border)] bg-white'
      }`}
    >
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
        Level {data.order}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-[var(--color-text)]">{data.label}</div>
      <div className="font-mono text-[10px] text-[var(--color-text-muted)]">{data.code}</div>
    </div>
  );
}

const nodeTypes = { schemaNode: SchemaGraphNode };

function GraphCanvas({ nodeTypes: types, edges }) {
  const { fitView } = useReactFlow();
  const { nodes, edges: flowEdges } = useMemo(
    () => schemaGraphElements({ nodeTypes: types, edges }),
    [types, edges],
  );

  useEffect(() => {
    if (nodes.length) {
      const timer = setTimeout(() => fitView({ padding: 0.25, duration: 300 }), 50);
      return () => clearTimeout(timer);
    }
  }, [nodes, flowEdges, fitView]);

  if (!types.length) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="text-sm font-medium text-[var(--color-text-secondary)]">No structure yet</div>
        <p className="mt-1 max-w-xs text-xs text-[var(--color-text-muted)]">
          Add structural rules on the left — relationships will appear here as you select parent and child types.
        </p>
      </div>
    );
  }

  if (!edges.length) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <div className="mb-4 flex flex-col items-center gap-2">
          {types.map((type) => (
            <div key={type.node_type_id} className="rounded-lg border border-[var(--color-border)] bg-white px-4 py-2 text-sm font-medium">
              {type.name}
            </div>
          ))}
        </div>
        <p className="max-w-xs text-xs text-[var(--color-text-muted)]">
          Node types loaded. Select parent → child in the form to preview relationships.
        </p>
      </div>
    );
  }

  return (
    <div className="h-full min-h-[420px] overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)]">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} color="#e2e8f0" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(n) => (n.data?.isDraft ? '#93c5fd' : '#2563eb')}
          maskColor="rgba(248, 249, 251, 0.8)"
          className="!rounded-md !border !border-[var(--color-border)]"
        />
      </ReactFlow>
    </div>
  );
}

export default function SchemaGraphView(props) {
  return (
    <ReactFlowProvider>
      <GraphCanvas {...props} />
    </ReactFlowProvider>
  );
}
