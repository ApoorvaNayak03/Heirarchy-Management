import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import SearchBar from '../components/SearchBar';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyTypeService } from '../services';

const emptyForm = { code: '', name: '', description: '', status: 'ACTIVE', allow_multiple_parents: false };

export default function HierarchyTypesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);

  const load = () => hierarchyTypeService.list({ search, status: status || undefined }).then((res) => setItems(res.data));
  useEffect(() => { load().catch(() => showToast('Failed to load hierarchy types', 'error')); }, [search, status]);

  const save = async () => {
    try {
      if (editId) await hierarchyTypeService.update(editId, form);
      else await hierarchyTypeService.create(form);
      showToast('Saved successfully', 'success');
      setModal(false);
      setForm(emptyForm);
      setEditId(null);
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Save failed', 'error');
    }
  };

  const remove = async (id) => {
    try {
      await hierarchyTypeService.delete(id);
      showToast('Deleted', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Hierarchy Types"
        actions={<button type="button" onClick={() => { setForm(emptyForm); setEditId(null); setModal(true); }} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Create</button>}
      />
      <div className="mb-4 flex gap-3">
        <SearchBar value={search} onChange={setSearch} />
        <select className="rounded-lg border px-3 py-2 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
      <DataTable
        columns={[
          { key: 'code', label: 'Code' },
          { key: 'name', label: 'Name' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'allow_multiple_parents', label: 'Multi Parent', render: (r) => r.allow_multiple_parents ? 'Yes' : 'No' },
          {
            key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex gap-2">
                <button type="button" className="text-blue-600" onClick={() => { setEditId(r.hierarchy_type_id); setForm(r); setModal(true); }}>Edit</button>
                <button type="button" className="text-red-600" onClick={() => remove(r.hierarchy_type_id)}>Delete</button>
              </div>
            ),
          },
        ]}
        data={items.map((i) => ({ ...i, id: i.hierarchy_type_id }))}
      />
      <Modal open={modal} title={editId ? 'Edit Hierarchy Type' : 'Create Hierarchy Type'} onClose={() => setModal(false)}>
        <div className="space-y-3">
          {!editId && <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />}
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <textarea className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Description" value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.allow_multiple_parents} onChange={(e) => setForm({ ...form, allow_multiple_parents: e.target.checked })} /> Allow multiple parents (DAG)</label>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save</button>
        </div>
      </Modal>
    </div>
  );
}
