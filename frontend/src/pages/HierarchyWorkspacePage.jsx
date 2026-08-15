import { ArrowLeft, GitCompare, Plus, Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import HierarchyGraphView from '../components/HierarchyGraphView';
import Modal from '../components/Modal';
import DraggableTreeView from '../components/workspace/DraggableTreeView';
import NodeDetailModal from '../components/workspace/NodeDetailModal';
import VersionRail from '../components/workspace/VersionRail';
import ViewToggle from '../components/workspace/ViewToggle';
import Button from '../components/ui/Button';
import FormField from '../components/ui/FormField';
import Input from '../components/ui/Input';
import StatusBadge from '../components/StatusBadge';
import { useToast } from '../hooks/useToast';
import { hierarchyService, propertyService, versionService } from '../services';
import { countNodes, filterTree, findNode, flattenTree } from '../utils/treeUtils';

const EDITABLE = ['DRAFT', 'REJECTED'];

export default function HierarchyWorkspacePage() {
  const { hierarchyId } = useParams();
  const { showToast } = useToast();

  const [detail, setDetail] = useState(null);
  const [versionId, setVersionId] = useState(null);
  const [version, setVersion] = useState(null);
  const [tree, setTree] = useState([]);
  const [view, setView] = useState('tree');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('add');
  const [selected, setSelected] = useState(null);
  const [parentForAdd, setParentForAdd] = useState(null);
  const [form, setForm] = useState({ node_type_id: '', display_name: '', properties: {} });
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [propertyDefs, setPropertyDefs] = useState([]);
  const [saving, setSaving] = useState(false);

  const [deleteNode, setDeleteNode] = useState(null);
  const [cloneNode, setCloneNode] = useState(null);
  const [cloneName, setCloneName] = useState('');

  const [validationResult, setValidationResult] = useState(null);

  const readOnly = version && !EDITABLE.includes(version.status);
  const displayTree = useMemo(() => filterTree(tree, search), [tree, search]);
  const nodeCount = useMemo(() => countNodes(tree), [tree]);

  const loadDetail = useCallback(async () => {
    const res = await hierarchyService.detail(hierarchyId);
    setDetail(res.data);
    return res.data;
  }, [hierarchyId]);

  const loadVersion = useCallback(async (vid) => {
    if (!vid) return;
    const [treeRes, verRes] = await Promise.all([
      versionService.tree(vid),
      versionService.get(vid),
    ]);
    setTree(treeRes.data);
    setVersion(verRes.data);
    setValidationResult(null);
  }, []);

  useEffect(() => {
    setLoading(true);
    loadDetail()
      .then((d) => {
        const initial =
          d.latest_draft?.hierarchy_version_id ||
          d.active_version?.hierarchy_version_id ||
          d.versions?.[0]?.hierarchy_version_id;
        if (initial) {
          setVersionId(initial);
          return loadVersion(initial);
        }
      })
      .catch(() => showToast('Failed to load hierarchy', 'error'))
      .finally(() => setLoading(false));
  }, [hierarchyId, loadDetail, loadVersion, showToast]);

  const refreshAll = async (vid = versionId) => {
    const d = await loadDetail();
    if (vid) await loadVersion(vid);
    return d;
  };

  const loadPropertyDefs = async (nodeTypeId) => {
    if (!nodeTypeId) {
      setPropertyDefs([]);
      return;
    }
    const defs = await propertyService.list({ node_type_id: nodeTypeId });
    setPropertyDefs(defs.data);
  };

  const openAdd = async (parent) => {
    if (readOnly || !versionId) return;
    setSelected(null);
    setParentForAdd(parent);
    setModalMode('add');
    const res = await versionService.allowedChildTypes(versionId, parent?.version_node_id);
    setAllowedTypes(res.data);
    const firstTypeId = res.data[0]?.node_type_id || '';
    setForm({ node_type_id: firstTypeId, display_name: '', properties: {} });
    await loadPropertyDefs(firstTypeId);
    setModalOpen(true);
  };

  const openEdit = async (node) => {
    if (readOnly) return;
    setSelected(node);
    setParentForAdd(null);
    setModalMode('edit');
    setForm({ display_name: node.display_name, properties: node.properties || {} });
    await loadPropertyDefs(node.node_type_id);
    setModalOpen(true);
  };

  const handleSelect = (node) => {
    if (readOnly) {
      setSelected(node);
      setModalMode('edit');
      setForm({ display_name: node.display_name, properties: node.properties || {} });
      loadPropertyDefs(node.node_type_id);
      setModalOpen(true);
    } else {
      openEdit(node);
    }
  };

  useEffect(() => {
    if (modalMode === 'add' && form.node_type_id) {
      loadPropertyDefs(form.node_type_id).catch(() => {});
    }
  }, [form.node_type_id, modalMode]);

  const saveNode = async () => {
    if (!form.display_name.trim()) {
      showToast('Display name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      if (modalMode === 'add') {
        await versionService.addNode(versionId, {
          ...form,
          parent_version_node_id: parentForAdd?.version_node_id || null,
        });
        showToast('Node added', 'success');
      } else if (selected) {
        await versionService.updateNode(versionId, selected.version_node_id, form);
        showToast('Node updated', 'success');
      }
      await loadVersion(versionId);
      setModalOpen(false);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.response?.data?.detail || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInlineEdit = async (node, displayName) => {
    try {
      await versionService.updateNode(versionId, node.version_node_id, {
        display_name: displayName,
        properties: node.properties || {},
      });
      showToast('Renamed', 'success');
      loadVersion(versionId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Rename failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await versionService.deleteNode(versionId, deleteNode.version_node_id);
      showToast('Node removed', 'success');
      setDeleteNode(null);
      setModalOpen(false);
      loadVersion(versionId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const handleClone = async () => {
    if (!cloneName.trim()) return;
    try {
      await versionService.cloneNode(versionId, cloneNode.version_node_id, { display_name: cloneName.trim() });
      showToast('Node cloned', 'success');
      setCloneNode(null);
      loadVersion(versionId);
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clone failed', 'error');
    }
  };

  const handleMove = async (draggedId, targetRef, position) => {
    if (readOnly) return;
    setBusy(true);
    try {
      let newParentId = null;
      let siblingOrder = null;

      const flat = flattenTree(tree);

      if (targetRef === null) {
        newParentId = null;
        siblingOrder = 0;
      } else if (position === 'before' || position === 'after') {
        const target = flat.find((n) => n.version_node_id === targetRef);
        if (!target) return;
        newParentId = target.parentId;
        siblingOrder = position === 'before' ? target.siblingIndex : target.siblingIndex + 1;
      } else {
        newParentId = targetRef;
        const targetNode = findNode(tree, targetRef);
        siblingOrder = targetNode?.children?.length || 0;
      }

      await versionService.moveNode(versionId, draggedId, {
        new_parent_version_node_id: newParentId,
        sibling_order: siblingOrder,
      });
      showToast('Node moved', 'success');
      await loadVersion(versionId);
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.response?.data?.detail || 'Move failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSelectVersion = async (vid) => {
    setVersionId(vid);
    setModalOpen(false);
    setLoading(true);
    await loadVersion(vid);
    setLoading(false);
  };

  const handleCreateVersion = async () => {
    setBusy(true);
    try {
      const res = await versionService.create(hierarchyId, {
        version_no: 'V1',
        version_name: 'Initial Version',
        valid_from: new Date().toISOString().slice(0, 10),
      });
      setVersionId(res.data.hierarchy_version_id);
      await refreshAll(res.data.hierarchy_version_id);
      showToast('Version created', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Failed to create version', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyVersion = async (sourceId, copyForm) => {
    setBusy(true);
    try {
      const res = await versionService.copy(sourceId, copyForm);
      setVersionId(res.data.hierarchy_version_id);
      await refreshAll(res.data.hierarchy_version_id);
      showToast('Version copied', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Copy failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleValidate = async () => {
    setBusy(true);
    try {
      const res = await versionService.validate(versionId);
      setValidationResult(res.data);
      showToast(res.data.valid ? 'Validation passed' : 'Validation failed', res.data.valid ? 'success' : 'error');
    } catch {
      showToast('Validation failed to run', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (payload) => {
    setBusy(true);
    try {
      await versionService.submit(versionId, payload);
      await refreshAll(versionId);
      showToast('Submitted for approval', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.response?.data?.detail || 'Submit failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleActivate = async (payload) => {
    setBusy(true);
    try {
      await versionService.activate(versionId, payload);
      await refreshAll(versionId);
      showToast('Version activated', 'success');
    } catch (err) {
      showToast(err.response?.data?.detail || 'Activation failed', 'error');
    } finally {
      setBusy(false);
    }
  };

  const graphHandlers = useMemo(() => ({
    onSelect: handleSelect,
    onAdd: openAdd,
    onEdit: openEdit,
    onDelete: setDeleteNode,
    onClone: (node) => { setCloneNode(node); setCloneName(`${node.display_name} Copy`); },
    onMove: handleMove,
  }), [versionId, readOnly, tree]);

  if (loading && !detail) {
    return (
      <div className="flex h-[calc(100vh-3rem)] items-center justify-center text-[13px] text-[var(--color-text-muted)]">
        Loading workspace…
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      {/* Toolbar */}
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link to="/" className="rounded-md p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-bg)] hover:text-[var(--color-text)]">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-[var(--color-text)]">{detail?.hierarchy?.name}</h1>
              {version && <StatusBadge status={version.status} />}
            </div>
            {version && (
              <p className="text-[11px] text-[var(--color-text-muted)]">
                {version.version_no}{version.version_name ? ` · ${version.version_name}` : ''}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(detail?.versions?.length || 0) > 1 && (
            <Link to={`/hierarchies/${hierarchyId}/compare${versionId ? `?b=${versionId}` : ''}`}>
              <Button size="sm" variant="secondary">
                <GitCompare size={14} /> Compare
              </Button>
            </Link>
          )}
          <div className="relative hidden sm:block">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" />
            <input
              type="search"
              placeholder="Search nodes…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-8 w-48 rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] pl-8 pr-3 text-xs outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)]"
            />
          </div>
          <ViewToggle view={view} onChange={setView} nodeCount={nodeCount} />
          {!readOnly && (
            <Button size="sm" onClick={() => openAdd(null)}>
              <Plus size={14} /> Add root
            </Button>
          )}
        </div>
      </header>

      {/* Validation banner */}
      {validationResult && !validationResult.valid && (
        <div className="shrink-0 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
          {validationResult.errors?.length} validation error(s) — click a node to fix, then re-validate
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <VersionRail
          hierarchy={detail?.hierarchy}
          hierarchyId={hierarchyId}
          versions={detail?.versions || []}
          version={version}
          onSelectVersion={handleSelectVersion}
          onCreateVersion={handleCreateVersion}
          onCopyVersion={handleCopyVersion}
          onCancelVersion={async () => {
            setBusy(true);
            try {
              await versionService.cancel(versionId);
              await refreshAll(versionId);
              showToast('Draft cancelled', 'success');
            } catch (err) {
              showToast(err.response?.data?.detail || 'Cancel failed', 'error');
            } finally {
              setBusy(false);
            }
          }}
          onReturnToDraft={async () => {
            setBusy(true);
            try {
              await versionService.returnToDraft(versionId);
              await refreshAll(versionId);
              showToast('Returned to draft', 'success');
            } catch (err) {
              showToast(err.response?.data?.detail || 'Failed', 'error');
            } finally {
              setBusy(false);
            }
          }}
          onValidate={handleValidate}
          onSubmit={handleSubmit}
          onActivate={handleActivate}
          validationResult={validationResult}
          loading={busy}
        />

        <main className="relative flex-1 overflow-hidden bg-[var(--color-bg)] p-4">
          {view === 'tree' ? (
            <DraggableTreeView
              tree={displayTree}
              selectedId={selected?.version_node_id}
              readOnly={readOnly}
              onSelect={handleSelect}
              onAdd={openAdd}
              onEdit={openEdit}
              onDelete={setDeleteNode}
              onClone={(node) => { setCloneNode(node); setCloneName(`${node.display_name} Copy`); }}
              onInlineEdit={handleInlineEdit}
              onMove={handleMove}
            />
          ) : (
            <HierarchyGraphView
              tree={displayTree}
              selectedId={selected?.version_node_id}
              readOnly={readOnly}
              {...graphHandlers}
            />
          )}
        </main>
      </div>

      <NodeDetailModal
        open={modalOpen}
        mode={modalMode}
        readOnly={readOnly}
        parentNode={parentForAdd}
        selectedNode={selected}
        form={form}
        allowedTypes={allowedTypes}
        propertyDefs={propertyDefs}
        onChange={setForm}
        onSave={saveNode}
        onClose={() => setModalOpen(false)}
        saving={saving}
      />

      <Modal open={!!cloneNode} title="Clone Node" onClose={() => setCloneNode(null)}>
        <div className="space-y-3">
          <FormField label="New node name" required>
            <Input value={cloneName} onChange={(e) => setCloneName(e.target.value)} autoFocus />
          </FormField>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setCloneNode(null)}>Cancel</Button>
            <Button onClick={handleClone}>Clone</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteNode}
        title="Remove Node"
        message={`Remove "${deleteNode?.display_name}" and its subtree?`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteNode(null)}
        confirmLabel="Remove"
        danger
      />
    </div>
  );
}
