import { useEffect, useState } from 'react';
import DataTable from '../components/DataTable';
import PageHeader from '../components/PageHeader';
import { governanceService } from '../services';

export default function AuditTrailPage() {
  const [items, setItems] = useState([]);
  const [filters, setFilters] = useState({ user: '', action: '', entity_type: '' });

  const load = () => governanceService.audit({
    user: filters.user || undefined,
    action: filters.action || undefined,
    entity_type: filters.entity_type || undefined,
  }).then((res) => setItems(res.data));

  useEffect(() => { load(); }, [filters]);

  return (
    <div>
      <PageHeader title="Audit Trail" subtitle="Read-only change history" />
      <div className="mb-4 grid gap-3 md:grid-cols-3">
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="User" value={filters.user} onChange={(e) => setFilters({ ...filters, user: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Action" value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} />
        <input className="rounded-lg border px-3 py-2 text-sm" placeholder="Entity type" value={filters.entity_type} onChange={(e) => setFilters({ ...filters, entity_type: e.target.value })} />
      </div>
      <DataTable
        columns={[
          { key: 'changed_at', label: 'Timestamp', render: (r) => new Date(r.changed_at).toLocaleString() },
          { key: 'changed_by', label: 'User' },
          { key: 'action', label: 'Action' },
          { key: 'entity_type', label: 'Entity' },
          { key: 'field_name', label: 'Field' },
          { key: 'old_value', label: 'Old Value' },
          { key: 'new_value', label: 'New Value' },
        ]}
        data={items.map((i) => ({ ...i, id: i.change_id }))}
        emptyMessage="No audit records found."
      />
    </div>
  );
}
