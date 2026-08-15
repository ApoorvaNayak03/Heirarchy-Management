import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyTypeService, nodeTypeService, structuralRuleService } from '../services';

export default function StructuralRulesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [nodeTypes, setNodeTypes] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ hierarchy_type_id: '', parent_node_type_id: '', child_node_type_id: '' });

  const load = () => structuralRuleService.list().then((res) => setItems(res.data));
  useEffect(() => { load(); hierarchyTypeService.list().then((r) => setTypes(r.data)); }, []);
  useEffect(() => { if (form.hierarchy_type_id) nodeTypeService.list({ hierarchy_type_id: form.hierarchy_type_id }).then((r) => setNodeTypes(r.data)); }, [form.hierarchy_type_id]);

  const save = async () => {
    const duplicate = items.some(
      (item) =>
        item.hierarchy_type_id === form.hierarchy_type_id
        && item.parent_node_type_id === form.parent_node_type_id
        && item.child_node_type_id === form.child_node_type_id,
    );
    if (duplicate) {
      showToast('This parent-child relationship is already defined', 'info');
      setModal(false);
      return;
    }
    try {
      await structuralRuleService.create(form);
      showToast('Rule created', 'success');
      setModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Structural Rules" actions={<button type="button" onClick={() => setModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Create</button>} />
      <DataTable
        columns={[
          { key: 'parent', label: 'Parent', render: (r) => r.parent_node_type_name },
          { key: 'child', label: 'Child', render: (r) => r.child_node_type_name },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
        data={items.map((i) => ({ ...i, id: i.structural_rule_id }))}
      />
      <Modal open={modal} title="Create Structural Rule" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.hierarchy_type_id} onChange={(e) => setForm({ ...form, hierarchy_type_id: e.target.value })}>
            <option value="">Hierarchy type</option>
            {types.map((t) => <option key={t.hierarchy_type_id} value={t.hierarchy_type_id}>{t.name}</option>)}
          </select>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.parent_node_type_id} onChange={(e) => setForm({ ...form, parent_node_type_id: e.target.value })}>
            <option value="">Parent node type</option>
            {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
          </select>
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.child_node_type_id} onChange={(e) => setForm({ ...form, child_node_type_id: e.target.value })}>
            <option value="">Child node type</option>
            {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
          </select>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save</button>
        </div>
      </Modal>
    </div>
  );
}
