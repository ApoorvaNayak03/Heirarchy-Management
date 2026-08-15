import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyTypeService, nodeTypeService } from '../services';

export default function NodeTypesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [filterType, setFilterType] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ hierarchy_type_id: '', code: '', name: '', display_order: 0 });

  const load = () => nodeTypeService.list({ hierarchy_type_id: filterType || undefined }).then((res) => setItems(res.data));
  useEffect(() => { hierarchyTypeService.list().then((r) => setTypes(r.data)); load(); }, [filterType]);

  const save = async () => {
    try {
      await nodeTypeService.create(form);
      showToast('Node type created', 'success');
      setModal(false);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Node Types" actions={<button type="button" onClick={() => setModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Create</button>} />
      <select className="mb-4 rounded-lg border px-3 py-2 text-sm" value={filterType} onChange={(e) => setFilterType(e.target.value)}>
        <option value="">All hierarchy types</option>
        {types.map((t) => <option key={t.hierarchy_type_id} value={t.hierarchy_type_id}>{t.name}</option>)}
      </select>
      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'display_order', label: 'Order' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
        ]}
        data={items.map((i) => ({ ...i, id: i.node_type_id }))}
      />
      <Modal open={modal} title="Create Node Type" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.hierarchy_type_id} onChange={(e) => setForm({ ...form, hierarchy_type_id: e.target.value })}>
            <option value="">Hierarchy type</option>
            {types.map((t) => <option key={t.hierarchy_type_id} value={t.hierarchy_type_id}>{t.name}</option>)}
          </select>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save</button>
        </div>
      </Modal>
    </div>
  );
}
