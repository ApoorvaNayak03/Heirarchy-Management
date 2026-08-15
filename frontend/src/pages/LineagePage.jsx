import { useCallback, useEffect, useState } from 'react';
import ReactFlow, { Background, Controls, MiniMap, useEdgesState, useNodesState } from 'reactflow';
import 'reactflow/dist/style.css';
import PageHeader from '../components/PageHeader';
import { governanceService, hierarchyService } from '../services';

export default function LineagePage() {
  const [hierarchies, setHierarchies] = useState([]);
  const [hierarchyId, setHierarchyId] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => { hierarchyService.list().then((res) => setHierarchies(res.data)); }, []);

  const load = useCallback(async () => {
    const res = await governanceService.lineage({ hierarchy_id: hierarchyId || undefined });
    setNodes(res.data.nodes.map((n, i) => ({ id: n.id, data: { label: n.label }, position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 120 }, type: n.type === 'version' ? 'input' : 'default' })));
    setEdges(res.data.edges.map((e) => ({ id: e.id, source: e.source, target: e.target, label: e.label })));
  }, [hierarchyId, setNodes, setEdges]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <PageHeader title="Lineage" subtitle="Version and node copy/clone lineage" />
      <select className="mb-4 rounded-lg border px-3 py-2 text-sm" value={hierarchyId} onChange={(e) => setHierarchyId(e.target.value)}>
        <option value="">All hierarchies</option>
        {hierarchies.map((h) => <option key={h.hierarchy_id} value={h.hierarchy_id}>{h.name}</option>)}
      </select>
      <div className="h-[600px] rounded-xl border bg-white">
        <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
}
