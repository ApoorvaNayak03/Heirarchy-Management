import { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../../../components/ConfirmDialog';
import HierarchyGraphView from '../../../components/HierarchyGraphView';
import Modal from '../../../components/Modal';
import NodeEditorPanel, { HierarchyViewToggle } from '../../../components/NodeEditorPanel';
import StatusBadge from '../../../components/StatusBadge';
import TreeView from '../../../components/TreeView';
import Button from '../../../components/ui/Button';
import FormField from '../../../components/ui/FormField';
import Input from '../../../components/ui/Input';
import { useWorkflow } from '../../../context/WorkflowContext';
import { useToast } from '../../../hooks/useToast';
import { propertyService, versionService } from '../../../services';
import { buildPreviewTree } from '../../../utils/treePreview';

function countNodes(tree) {
  return tree.reduce((sum, node) => sum + 1 + countNodes(node.children || []), 0);
}

export default function Step6Build({ setActions }) {
  const { session, completeStep, updateSession } = useWorkflow();
  const { showToast } = useToast();
  const [version, setVersion] = useState(null);
  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState(null);
  const [mode, setMode] = useState('add');
  const [view, setView] = useState('tree');
  const [deleteNode, setDeleteNode] = useState(null);
  const [cloneNode, setCloneNode] = useState(null);
  const [cloneName, setCloneName] = useState('');
  const [parentForAdd, setParentForAdd] = useState(null);
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [propertyDefs, setPropertyDefs] = useState([]);
  const [addForm, setAddForm] = useState({ node_type_id: '', display_name: '', properties: {} });
  const [editForm, setEditForm] = useState({ display_name: '', properties: {} });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const readOnly = version && !['DRAFT', 'REJECTED'].includes(version.status);

  const loadTree = async () => {
    if (!session.versionId) return;
    const [treeRes, verRes] = await Promise.all([
      versionService.tree(session.versionId),
      versionService.get(session.versionId),
    ]);
    setTree(treeRes.data);
    setVersion(verRes.data);
    updateSession({ versionStatus: verRes.data.status });
  };

  useEffect(() => { loadTree().catch(() => {}); }, [session.versionId]);

  useEffect(() => {
    if (session.versionId && !readOnly && allowedTypes.length === 0 && mode === 'add') {
      startAdd(null).catch(() => {});
    }
  }, [session.versionId, readOnly]);

  const previewTree = useMemo(
    () => buildPreviewTree(tree, { mode, addForm, allowedTypes, parentForAdd }),
    [tree, mode, addForm, allowedTypes, parentForAdd],
  );

  const nodeCount = useMemo(() => countNodes(tree), [tree]);

  const loadPropertyDefs = async (nodeTypeId) => {
    if (!nodeTypeId) {
      setPropertyDefs([]);
      return;
    }
    const defs = await propertyService.list({ node_type_id: nodeTypeId });
    setPropertyDefs(defs.data);
  };

  const startAdd = async (parent) => {
    setSelected(null);
    setParentForAdd(parent);
    setMode('add');
    const res = await versionService.allowedChildTypes(session.versionId, parent?.version_node_id);
    setAllowedTypes(res.data);
    const firstTypeId = res.data[0]?.node_type_id || '';
    setAddForm({ node_type_id: firstTypeId, display_name: '', properties: {} });
    await loadPropertyDefs(firstTypeId);
  };

  const startEdit = async (node) => {
    if (node.isDraft) return;
    setSelected(node);
    setParentForAdd(null);
    setMode('edit');
    setEditForm({ display_name: node.display_name, properties: node.properties || {} });
    await loadPropertyDefs(node.node_type_id);
  };

  const handleSelect = (node) => {
    if (node.isDraft) return;
    startEdit(node);
  };

  useEffect(() => {
    if (mode === 'add' && addForm.node_type_id) {
      loadPropertyDefs(addForm.node_type_id).catch(() => {});
    }
  }, [addForm.node_type_id, mode]);

  const saveAdd = async () => {
    if (!addForm.display_name.trim()) {
      showToast('Display name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      await versionService.addNode(session.versionId, {
        ...addForm,
        parent_version_node_id: parentForAdd?.version_node_id || null,
      });
      showToast('Node added', 'success');
      await loadTree();
      setAddForm({ ...addForm, display_name: '', properties: {} });
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to add node', 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await versionService.updateNode(session.versionId, selected.version_node_id, editForm);
      showToast('Node updated', 'success');
      await loadTree();
      setSelected((prev) => (prev ? { ...prev, display_name: editForm.display_name, properties: editForm.properties } : prev));
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleInlineEdit = async (node, displayName) => {
    try {
      await versionService.updateNode(session.versionId, node.version_node_id, {
        display_name: displayName,
        properties: node.properties || {},
      });
      showToast('Node renamed', 'success');
      if (selected?.version_node_id === node.version_node_id) {
        setEditForm((prev) => ({ ...prev, display_name: displayName }));
        setSelected((prev) => (prev ? { ...prev, display_name: displayName } : prev));
      }
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Rename failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await versionService.deleteNode(session.versionId, deleteNode.version_node_id);
      showToast('Node removed', 'success');
      if (selected?.version_node_id === deleteNode.version_node_id) {
        setSelected(null);
        setMode('add');
      }
      setDeleteNode(null);
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const openClone = (node) => {
    setCloneNode(node);
    setCloneName(`${node.display_name} Copy`);
  };

  const handleClone = async () => {
    if (!cloneName.trim()) return;
    try {
      await versionService.cloneNode(session.versionId, cloneNode.version_node_id, { display_name: cloneName.trim() });
      showToast('Node cloned', 'success');
      setCloneNode(null);
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clone failed', 'error');
    }
  };

  const handleContinue = async () => {
    if (!tree.length) {
      showToast('Add at least one node to the hierarchy', 'error');
      return;
    }
    setLoading(true);
    completeStep(6);
    setLoading(false);
  };

  useEffect(() => {
    setActions({ onContinue: handleContinue, loading, continueDisabled: !tree.length || readOnly });
  }, [tree, loading, readOnly]);

  const graphHandlers = useMemo(() => ({
    onSelect: handleSelect,
    onAdd: startAdd,
    onEdit: startEdit,
    onDelete: setDeleteNode,
    onClone: openClone,
  }), [session.versionId]);

  return (
    <div className="-mx-2 space-y-4 xl:-mx-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-2 xl:px-8">
        <div className="flex items-center gap-2">
          {version && <StatusBadge status={version.status} />}
          {readOnly && <span className="text-xs text-[var(--color-text-muted)]">Read-only — version is locked</span>}
        </div>
        {!readOnly && tree.length === 0 && mode !== 'add' && (
          <Button size="sm" onClick={() => startAdd(null)}>Add first node</Button>
        )}
      </div>

      <div className="grid gap-4 px-2 xl:grid-cols-2 xl:gap-5 xl:px-8">
        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <NodeEditorPanel
            mode={mode}
            readOnly={readOnly}
            parentForAdd={parentForAdd}
            selected={selected}
            addForm={addForm}
            editForm={editForm}
            allowedTypes={allowedTypes}
            propertyDefs={propertyDefs}
            onAddFormChange={setAddForm}
            onEditFormChange={setEditForm}
            onSaveAdd={saveAdd}
            onSaveEdit={saveEdit}
            onCancel={() => { setSelected(null); setMode('add'); startAdd(null); }}
            onStartAddRoot={() => startAdd(null)}
            saving={saving}
          />
        </section>

        <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-sm">
          <div className="border-b border-[var(--color-border)] px-4 py-3">
            <HierarchyViewToggle view={view} onChange={setView} nodeCount={nodeCount} />
            <p className="mt-2 text-xs text-[var(--color-text-muted)]">
              Click nodes to edit. Use action buttons or double-click names to rename in the tree.
            </p>
          </div>
          <div className="flex-1 p-4">
            {view === 'tree' ? (
              <TreeView
                tree={previewTree}
                selectedId={selected?.version_node_id}
                onSelect={handleSelect}
                onAdd={startAdd}
                onEdit={startEdit}
                onDelete={setDeleteNode}
                onClone={openClone}
                onInlineEdit={handleInlineEdit}
                readOnly={readOnly}
              />
            ) : (
              <HierarchyGraphView
                tree={previewTree}
                selectedId={selected?.version_node_id}
                readOnly={readOnly}
                {...graphHandlers}
              />
            )}
          </div>
        </section>
      </div>

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
