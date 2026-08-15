import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyService, versionService } from '../services';

export default function VersionsPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState([]);
  const [hierarchies, setHierarchies] = useState([]);
  const [filter, setFilter] = useState({ hierarchy_id: '', status: '' });

  const load = () => versionService.list({ hierarchy_id: filter.hierarchy_id || undefined, status: filter.status || undefined }).then((res) => setItems(res.data));
  useEffect(() => { hierarchyService.list().then((r) => setHierarchies(r.data)); load(); }, [filter]);

  const copyVersion = async (id) => {
    try {
      await versionService.copy(id, { version_name: 'Copied version' });
      showToast('Version copied', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Copy failed', 'error');
    }
  };

  const activate = async (id) => {
    try {
      await versionService.activate(id, {});
      showToast('Version activated', 'success');
      load();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Activation failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader title="Versions" subtitle="Manage hierarchy versions and lifecycle" />
      <div className="mb-4 flex gap-3">
        <select className="rounded-lg border px-3 py-2 text-sm" value={filter.hierarchy_id} onChange={(e) => setFilter({ ...filter, hierarchy_id: e.target.value })}>
          <option value="">All hierarchies</option>
          {hierarchies.map((h) => <option key={h.hierarchy_id} value={h.hierarchy_id}>{h.name}</option>)}
        </select>
        <select className="rounded-lg border px-3 py-2 text-sm" value={filter.status} onChange={(e) => setFilter({ ...filter, status: e.target.value })}>
          <option value="">All statuses</option>
          {['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'ACTIVE', 'REJECTED', 'RETIRED'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <DataTable
        columns={[
          { key: 'version_no', label: 'Version' },
          { key: 'version_name', label: 'Name' },
          { key: 'status', label: 'Status', render: (r) => <StatusBadge status={r.status} /> },
          { key: 'valid_from', label: 'Valid From' },
          {
            key: 'actions', label: 'Actions', render: (r) => (
              <div className="flex gap-2 text-sm">
                <Link to={`/builder?version=${r.hierarchy_version_id}`} className="text-blue-600">Builder</Link>
                <button type="button" onClick={() => copyVersion(r.hierarchy_version_id)}>Copy</button>
                {r.status === 'APPROVED' && <button type="button" onClick={() => activate(r.hierarchy_version_id)}>Activate</button>}
                {r.status === 'REJECTED' && <button type="button" onClick={() => versionService.returnToDraft(r.hierarchy_version_id).then(load)}>Return to Draft</button>}
              </div>
            ),
          },
        ]}
        data={items.map((i) => ({ ...i, id: i.hierarchy_version_id }))}
      />
    </div>
  );
}
