import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PropertyFieldRenderer from '../components/PropertyFieldRenderer';
import { useToast } from '../hooks/useToast';
import { hierarchyTypeService, nodeTypeService, propertyService } from '../services';

export default function PropertyDefinitionsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [nodeTypes, setNodeTypes] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState({ hierarchy_type_id: '', node_type_id: '', property_code: '', display_label: '', data_type: 'STRING', required: false, allowed_values: [] });

  useEffect(() => {
    propertyService.list().then((res) => setItems(res.data));
    hierarchyTypeService.list().then((res) => setTypes(res.data));
  }, []);

  useEffect(() => {
    if (form.hierarchy_type_id) nodeTypeService.list({ hierarchy_type_id: form.hierarchy_type_id }).then((r) => setNodeTypes(r.data));
  }, [form.hierarchy_type_id]);

  const save = async () => {
    try {
      const payload = { ...form, allowed_values: form.data_type === 'ENUM' ? form.allowed_values : null };
      await propertyService.create(payload);
      showToast('Property definition created', 'success');
      setModal(false);
      propertyService.list().then((res) => setItems(res.data));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Property Definitions" actions={<button type="button" onClick={() => setModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Create</button>} />
      <DataTable
        columns={[
          { key: 'property_code', label: 'Code' },
          { key: 'display_label', label: 'Label' },
          { key: 'data_type', label: 'Datatype' },
          { key: 'required', label: 'Required', render: (r) => r.required ? 'Yes' : 'No' },
        ]}
        data={items.map((i) => ({ ...i, id: i.property_definition_id }))}
      />
      <Modal open={modal} title="Create Property Definition" onClose={() => setModal(false)} wide>
        <div className="grid gap-3 md:grid-cols-2">
          <select className="rounded-lg border px-3 py-2 text-sm" value={form.hierarchy_type_id} onChange={(e) => setForm({ ...form, hierarchy_type_id: e.target.value })}>
            <option value="">Hierarchy type</option>
            {types.map((t) => <option key={t.hierarchy_type_id} value={t.hierarchy_type_id}>{t.name}</option>)}
          </select>
          <select className="rounded-lg border px-3 py-2 text-sm" value={form.node_type_id} onChange={(e) => setForm({ ...form, node_type_id: e.target.value })}>
            <option value="">Node type</option>
            {nodeTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
          </select>
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Property code" value={form.property_code} onChange={(e) => setForm({ ...form, property_code: e.target.value })} />
          <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Display label" value={form.display_label} onChange={(e) => setForm({ ...form, display_label: e.target.value })} />
          <select className="rounded-lg border px-3 py-2 text-sm" value={form.data_type} onChange={(e) => setForm({ ...form, data_type: e.target.value })}>
            {['STRING', 'NUMBER', 'DATE', 'BOOLEAN', 'ENUM', 'REFERENCE'].map((t) => <option key={t}>{t}</option>)}
          </select>
          {form.data_type === 'ENUM' && (
            <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Allowed values (comma separated)" onChange={(e) => setForm({ ...form, allowed_values: e.target.value.split(',').map((v) => v.trim()) })} />
          )}
          <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.target.checked })} /> Required</label>
          <button type="button" onClick={save} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white md:col-span-2">Save</button>
        </div>
      </Modal>
    </div>
  );
}
