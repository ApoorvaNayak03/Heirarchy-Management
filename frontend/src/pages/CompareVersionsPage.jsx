import {
  ArrowLeft,
  ArrowLeftRight,
  Expand,
  Maximize2,
  Minimize2,
  Search,
  Shrink,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import CompareTreePanel from '../components/compare/CompareTreePanel';
import '../components/compare/compare.css';
import Button from '../components/ui/Button';
import { useToast } from '../hooks/useToast';
import { hierarchyService, versionService } from '../services';
import { countNodes, filterTree } from '../utils/treeUtils';

export default function CompareVersionsPage() {
  const { hierarchyId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();
  const containerRef = useRef(null);

  const [detail, setDetail] = useState(null);
  const [versionAId, setVersionAId] = useState(searchParams.get('a') || '');
  const [versionBId, setVersionBId] = useState(searchParams.get('b') || '');
  const [treeA, setTreeA] = useState([]);
  const [treeB, setTreeB] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [allExpanded, setAllExpanded] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [collapsedA, setCollapsedA] = useState(false);
  const [collapsedB, setCollapsedB] = useState(false);

  const versions = detail?.versions || [];
  const versionA = versions.find((v) => v.hierarchy_version_id === versionAId);
  const versionB = versions.find((v) => v.hierarchy_version_id === versionBId);

  const displayA = useMemo(() => filterTree(treeA, search), [treeA, search]);
  const displayB = useMemo(() => filterTree(treeB, search), [treeB, search]);

  useEffect(() => {
    hierarchyService.detail(hierarchyId)
      .then((res) => {
        setDetail(res.data);
        const vs = res.data.versions || [];
        const paramA = searchParams.get('a');
        const paramB = searchParams.get('b');

        if (paramA && paramB) {
          setVersionAId(paramA);
          setVersionBId(paramB);
        } else if (paramB) {
          const active = vs.find((v) => v.status === 'ACTIVE');
          setVersionBId(paramB);
          setVersionAId(active?.hierarchy_version_id || vs.find((v) => v.hierarchy_version_id !== paramB)?.hierarchy_version_id || '');
        } else if (paramA) {
          setVersionAId(paramA);
          setVersionBId(vs.find((v) => v.hierarchy_version_id !== paramA)?.hierarchy_version_id || '');
        } else if (vs.length >= 2) {
          const active = vs.find((v) => v.status === 'ACTIVE');
          const draft = vs.find((v) => v.status === 'DRAFT');
          const a = active?.hierarchy_version_id || vs[1]?.hierarchy_version_id;
          const b = draft?.hierarchy_version_id || vs[0]?.hierarchy_version_id;
          setVersionAId(a !== b ? a : vs[1].hierarchy_version_id);
          setVersionBId(a !== b ? b : vs[0].hierarchy_version_id);
        }
      })
      .catch(() => showToast('Failed to load', 'error'))
      .finally(() => setLoading(false));
  }, [hierarchyId]);

  const loadTrees = useCallback(async () => {
    if (!versionAId || !versionBId || versionAId === versionBId) return;
    setSearchParams({ a: versionAId, b: versionBId });
    try {
      const [treeARes, treeBRes] = await Promise.all([
        versionService.tree(versionAId),
        versionService.tree(versionBId),
      ]);
      setTreeA(treeARes.data);
      setTreeB(treeBRes.data);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to load trees', 'error');
    }
  }, [versionAId, versionBId, setSearchParams, showToast]);

  useEffect(() => {
    if (versionAId && versionBId && versionAId !== versionBId) loadTrees();
  }, [versionAId, versionBId, loadTrees]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && fullscreen) setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreen]);

  if (loading) {
    return <div className="flex h-[calc(100vh-3rem)] items-center justify-center text-xs text-[#9aa0a6]">Loading…</div>;
  }

  if (versions.length < 2) {
    return (
      <div className="flex h-[calc(100vh-3rem)] flex-col items-center justify-center gap-3">
        <p className="text-sm text-[#5f6368]">Need at least 2 versions to compare.</p>
        <Link to={`/hierarchies/${hierarchyId}`}>
          <Button variant="secondary" size="sm"><ArrowLeft size={14} /> Back</Button>
        </Link>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`compare-page flex flex-col ${fullscreen ? 'fixed inset-0 z-[200]' : 'h-[calc(100vh-3rem)]'}`}
    >
      <div className="compare-toolbar flex shrink-0 flex-wrap items-center gap-3 px-4 py-2.5">
        {!fullscreen && (
          <Link to={`/hierarchies/${hierarchyId}`} className="rounded p-1 text-[#9aa0a6] hover:text-[#202124]">
            <ArrowLeft size={16} />
          </Link>
        )}

        <span className="text-sm font-medium text-[#202124]">{detail?.hierarchy?.name}</span>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <select className="compare-version-select" value={versionAId} onChange={(e) => setVersionAId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.hierarchy_version_id} value={v.hierarchy_version_id} disabled={v.hierarchy_version_id === versionBId}>
                {v.version_no}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => { setVersionAId(versionBId); setVersionBId(versionAId); }} className="rounded p-1 text-[#9aa0a6] hover:text-[#202124]">
            <ArrowLeftRight size={14} />
          </button>
          <select className="compare-version-select" value={versionBId} onChange={(e) => setVersionBId(e.target.value)}>
            {versions.map((v) => (
              <option key={v.hierarchy_version_id} value={v.hierarchy_version_id} disabled={v.hierarchy_version_id === versionAId}>
                {v.version_no}
              </option>
            ))}
          </select>

          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9aa0a6]" />
            <input
              type="search"
              placeholder="Search nodes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="compare-search"
            />
          </div>

          <button type="button" onClick={() => setAllExpanded(!allExpanded)} className="compare-tool-btn">
            {allExpanded ? <Shrink size={13} /> : <Expand size={13} />}
            {allExpanded ? 'Collapse all' : 'Expand all'}
          </button>

          <button type="button" onClick={() => setFullscreen(!fullscreen)} className="compare-tool-btn">
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-4 overflow-hidden p-4 lg:grid-cols-2">
        <CompareTreePanel
          version={versionA}
          tree={displayA}
          allExpanded={allExpanded}
          collapsed={collapsedA}
          onToggleCollapse={() => setCollapsedA(!collapsedA)}
          nodeCount={countNodes(treeA)}
        />
        <CompareTreePanel
          version={versionB}
          tree={displayB}
          allExpanded={allExpanded}
          collapsed={collapsedB}
          onToggleCollapse={() => setCollapsedB(!collapsedB)}
          nodeCount={countNodes(treeB)}
        />
      </div>
    </div>
  );
}
