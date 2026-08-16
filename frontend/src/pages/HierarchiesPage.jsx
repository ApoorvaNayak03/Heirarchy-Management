import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyService, hierarchyTypeService } from '../services';

export default function HierarchiesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ hierarchy_type_id: '', code: '', name: '', description: '' });

  useEffect(() => {
    hierarchyService.list().then((res) => setItems(res.data));
    hierarchyTypeService.list().then((res) => setTypes(res.data));
  }, []);

  const save = async () => {
    try {
      await hierarchyService.create(form);
      showToast('Hierarchy created', 'success');
      setModal(false);
      const res = await hierarchyService.list();
      setItems(res.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Create failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this hierarchy? This cannot be undone.')) return;
    try {
      await hierarchyService.delete(id);
      showToast('Hierarchy deleted', 'success');
      const res = await hierarchyService.list();
      setItems(res.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Hierarchies" actions={<button type="button" onClick={() => setModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Create</button>} />
      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          {
            key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex gap-2">
                <Link to={`/hierarchies/${r.hierarchy_id}`} className="text-blue-600">View</Link>
                <button type="button" className="text-red-600" onClick={() => remove(r.hierarchy_id)}>Delete</button>
              </div>
            ),
          },
        ]}
        data={items.map((i) => ({ ...i, id: i.hierarchy_id }))}
      />
      <Modal open={modal} title="Create Hierarchy" onClose={() => setModal(false)}>
        <div className="space-y-3">
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={form.hierarchy_type_id} onChange={(e) => setForm({ ...form, hierarchy_type_id: e.target.value })}>
            <option value="">Select hierarchy type</option>
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
