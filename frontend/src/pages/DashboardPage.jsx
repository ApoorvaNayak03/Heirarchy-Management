import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { dashboardService } from '../services';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    dashboardService.stats()
      .then((res) => setStats(res.data))
      .catch(() => setError('Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-sm text-slate-500">Loading dashboard...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  const cards = [
    { label: 'Hierarchy Types', value: stats.total_hierarchy_types },
    { label: 'Hierarchies', value: stats.total_hierarchies },
    { label: 'Active Versions', value: stats.active_versions },
    { label: 'Draft Versions', value: stats.draft_versions },
    { label: 'Pending Approvals', value: stats.pending_approvals },
  ];

  return (
    <div>
      <PageHeader title="Dashboard" subtitle="Overview of hierarchy management activity" />
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">{card.label}</div>
            <div className="mt-2 text-3xl font-semibold text-slate-900">{card.value}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Recent Activity</h2>
          <div className="space-y-3">
            {stats.recent_changes?.length ? stats.recent_changes.map((c) => (
              <div key={c.change_id} className="border-b border-slate-100 pb-3 text-sm last:border-0">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{c.action}</span>
                  <span className="text-xs text-slate-400">{new Date(c.changed_at).toLocaleString()}</span>
                </div>
                <div className="text-slate-600">{c.entity_type} by {c.changed_by}</div>
              </div>
            )) : <p className="text-sm text-slate-500">No recent changes.</p>}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Versions Approaching Effective Date</h2>
          <div className="space-y-3">
            {stats.versions_approaching_effective_date?.length ? stats.versions_approaching_effective_date.map((v) => (
              <div key={v.hierarchy_version_id} className="flex items-center justify-between text-sm">
                <div>
                  <div className="font-medium">{v.version_no} - {v.version_name}</div>
                  <div className="text-slate-500">Effective: {v.valid_from}</div>
                </div>
                <StatusBadge status={v.status} />
              </div>
            )) : <p className="text-sm text-slate-500">No upcoming activations.</p>}
          </div>
        </div>
      </div>
      <div className="mt-6">
        <Link to="/builder" className="text-sm font-medium text-blue-600 hover:underline">Open Hierarchy Builder →</Link>
      </div>
    </div>
  );
}
