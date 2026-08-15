import { useEffect, useState } from 'react';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';
import { versionService } from '../services';

export default function ValidationPage() {
  const { showToast } = useToast();
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { versionService.list().then((res) => { setVersions(res.data); if (res.data.length) setVersionId(res.data[0].hierarchy_version_id); }); }, []);

  const run = async () => {
    setLoading(true);
    try {
      const res = await versionService.validate(versionId);
      setResult(res.data);
    } catch {
      showToast('Validation failed to run', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader title="Validation" subtitle="Run structural, property, and version validation" actions={
        <button type="button" onClick={run} disabled={loading} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">{loading ? 'Running...' : 'Run Validation'}</button>
      } />
      <select className="mb-4 rounded-lg border px-3 py-2 text-sm" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
        {versions.map((v) => <option key={v.hierarchy_version_id} value={v.hierarchy_version_id}>{v.version_no} ({v.status})</option>)}
      </select>
      {result && (
        <div className="rounded-xl border bg-white p-5">
          <div className={`mb-4 text-lg font-semibold ${result.valid ? 'text-emerald-700' : 'text-red-700'}`}>{result.valid ? 'Validation passed' : 'Validation failed'}</div>
          {result.errors?.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 font-medium text-red-700">Errors</h3>
              <ul className="space-y-2 text-sm">{result.errors.map((e, i) => <li key={i} className="rounded bg-red-50 p-2">{e.type}: {e.message}</li>)}</ul>
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div>
              <h3 className="mb-2 font-medium text-amber-700">Warnings</h3>
              <ul className="space-y-2 text-sm">{result.warnings.map((e, i) => <li key={i} className="rounded bg-amber-50 p-2">{e.message}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
