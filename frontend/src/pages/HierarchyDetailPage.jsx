import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusBadge from '../components/StatusBadge';
import { hierarchyService } from '../services';

export default function HierarchyDetailPage() {
  const { id } = useParams();
  const [detail, setDetail] = useState(null);
  const [businessDate, setBusinessDate] = useState('2026-08-15');
  const [effective, setEffective] = useState(null);

  useEffect(() => {
    hierarchyService.detail(id).then((res) => setDetail(res.data));
  }, [id]);

  const lookup = async () => {
    try {
      const res = await hierarchyService.effectiveVersion(id, businessDate);
      setEffective(res.data);
    } catch {
      setEffective(null);
    }
  };

  if (!detail) return <div className="text-sm text-slate-500">Loading...</div>;

  return (
    <div>
      <PageHeader title={detail.hierarchy.name} subtitle={detail.hierarchy.code} actions={<Link to={`/builder?hierarchy=${id}`} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Open Builder</Link>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Hierarchy Information</h2>
          <p className="text-sm text-slate-600">{detail.hierarchy.description || 'No description'}</p>
          <div className="mt-2"><StatusBadge status={detail.hierarchy.status} /></div>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Historical Lookup</h2>
          <div className="flex gap-2">
            <input type="date" className="rounded-lg border px-3 py-2 text-sm" value={businessDate} onChange={(e) => setBusinessDate(e.target.value)} />
            <button type="button" onClick={lookup} className="rounded-lg bg-slate-800 px-4 py-2 text-sm text-white">Lookup</button>
          </div>
          {effective && <p className="mt-3 text-sm">Effective version: <strong>{effective.version_no}</strong> ({effective.status})</p>}
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Current Active Version</h2>
          {detail.active_version ? <div className="text-sm">{detail.active_version.version_no} <StatusBadge status={detail.active_version.status} /></div> : <p className="text-sm text-slate-500">None</p>}
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="mb-3 font-semibold">Latest Draft</h2>
          {detail.latest_draft ? <div className="text-sm">{detail.latest_draft.version_no} <StatusBadge status={detail.latest_draft.status} /></div> : <p className="text-sm text-slate-500">None</p>}
        </div>
      </div>
      <div className="mt-6 rounded-xl border bg-white p-5">
        <h2 className="mb-3 font-semibold">Version History</h2>
        <div className="space-y-2">
          {detail.versions.map((v) => (
            <div key={v.hierarchy_version_id} className="flex items-center justify-between border-b py-2 text-sm last:border-0">
              <span>{v.version_no} - {v.version_name}</span>
              <StatusBadge status={v.status} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
