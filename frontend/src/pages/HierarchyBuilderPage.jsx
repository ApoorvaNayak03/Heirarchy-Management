import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import ConfirmDialog from '../components/ConfirmDialog';
import CustomPropertiesEditor from '../components/CustomPropertiesEditor';
import Modal from '../components/Modal';
import PageHeader from '../components/PageHeader';
import PropertyFieldRenderer from '../components/PropertyFieldRenderer';
import StatusBadge from '../components/StatusBadge';
import TreeView from '../components/TreeView';
import { useToast } from '../hooks/useToast';
import { hierarchyService, propertyService, versionService } from '../services';

export default function HierarchyBuilderPage() {
  const { showToast } = useToast();
  const [params] = useSearchParams();
  const [versions, setVersions] = useState([]);
  const [versionId, setVersionId] = useState(params.get('version') || '');
  const [version, setVersion] = useState(null);
  const [tree, setTree] = useState([]);
  const [selected, setSelected] = useState(null);
  const [addModal, setAddModal] = useState(false);
  const [editModal, setEditModal] = useState(false);
  const [deleteNode, setDeleteNode] = useState(null);
  const [parentForAdd, setParentForAdd] = useState(null);
  const [allowedTypes, setAllowedTypes] = useState([]);
  const [propertyDefs, setPropertyDefs] = useState([]);
  const [addForm, setAddForm] = useState({ node_type_id: '', display_name: '', properties: {} });
  const [editForm, setEditForm] = useState({ display_name: '', properties: {} });
  const [submitModal, setSubmitModal] = useState(false);
  const [submitForm, setSubmitForm] = useState({ comment: '', approval_steps: [{ step_sequence: 1, approver_role_or_user: 'Supply Chain Manager' }] });

  const readOnly = version && !['DRAFT', 'REJECTED'].includes(version.status);

  const loadTree = async (vid = versionId) => {
    if (!vid) return;
    const [treeRes, verRes] = await Promise.all([versionService.tree(vid), versionService.get(vid)]);
    setTree(treeRes.data);
    setVersion(verRes.data);
  };

  useEffect(() => {
    versionService.list().then((res) => {
      setVersions(res.data);
      if (!versionId && res.data.length) setVersionId(res.data.find((v) => v.status === 'DRAFT')?.hierarchy_version_id || res.data[0].hierarchy_version_id);
    });
  }, []);

  useEffect(() => { if (versionId) loadTree(versionId); }, [versionId]);

  const openAdd = async (parent) => {
    setParentForAdd(parent);
    const res = await versionService.allowedChildTypes(versionId, parent?.version_node_id);
    setAllowedTypes(res.data);
    setAddForm({ node_type_id: res.data[0]?.node_type_id || '', display_name: '', properties: {} });
    setAddModal(true);
  };

  const saveAdd = async () => {
    try {
      await versionService.addNode(versionId, {
        ...addForm,
        parent_version_node_id: parentForAdd?.version_node_id || null,
      });
      showToast('Node added', 'success');
      setAddModal(false);
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail?.message || err.response?.data?.detail || 'Failed to add node', 'error');
    }
  };

  const openEdit = async (node) => {
    setSelected(node);
    setEditForm({ display_name: node.display_name, properties: node.properties || {} });
    const hierarchy = (await hierarchyService.list()).data[0];
    if (hierarchy) {
      const defs = await propertyService.list({ node_type_id: node.node_type_id });
      setPropertyDefs(defs.data);
    }
    setEditModal(true);
  };

  const saveEdit = async () => {
    try {
      await versionService.updateNode(versionId, selected.version_node_id, editForm);
      showToast('Node updated', 'success');
      setEditModal(false);
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Update failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      await versionService.deleteNode(versionId, deleteNode.version_node_id);
      showToast('Node removed', 'success');
      setDeleteNode(null);
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Delete failed', 'error');
    }
  };

  const handleClone = async (node) => {
    const name = prompt('Clone name', `${node.display_name} Copy`);
    if (!name) return;
    try {
      await versionService.cloneNode(versionId, node.version_node_id, { display_name: name });
      showToast('Node cloned', 'success');
      loadTree();
    } catch (err) {
      showToast(err.response?.data?.detail || 'Clone failed', 'error');
    }
  };

  const handleSubmit = async () => {
    try {
      await versionService.submit(versionId, submitForm);
      showToast('Submitted for approval', 'success');
      setSubmitModal(false);
      loadTree();
    } catch (err) {
      const detail = err.response?.data?.detail;
      showToast(typeof detail === 'object' ? detail.message : detail || 'Submit failed', 'error');
    }
  };

  return (
    <div>
      <PageHeader
        title="Hierarchy Builder"
        subtitle={version ? `${version.version_no} - ${version.version_name || ''}` : ''}
        actions={(
          <div className="flex gap-2">
            <select className="rounded-lg border px-3 py-2 text-sm" value={versionId} onChange={(e) => setVersionId(e.target.value)}>
              {versions.map((v) => <option key={v.hierarchy_version_id} value={v.hierarchy_version_id}>{v.version_no} ({v.status})</option>)}
            </select>
            {!readOnly && (
              <>
                <button type="button" onClick={() => openAdd(null)} className="rounded-lg border px-4 py-2 text-sm">Add Root</button>
                <button type="button" onClick={() => setSubmitModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Submit for Approval</button>
              </>
            )}
          </div>
        )}
      />
      {version && <div className="mb-4"><StatusBadge status={version.status} /> {readOnly && <span className="ml-2 text-sm text-amber-700">Read-only</span>}</div>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TreeView
            tree={tree}
            selectedId={selected?.version_node_id}
            onSelect={setSelected}
            onAdd={openAdd}
            onEdit={openEdit}
            onDelete={setDeleteNode}
            onClone={handleClone}
            readOnly={readOnly}
          />
        </div>
        <div className="rounded-xl border bg-white p-4">
          <h3 className="mb-3 font-semibold">Selected Node</h3>
          {selected ? (
            <div className="space-y-2 text-sm">
              <div><strong>{selected.display_name}</strong></div>
              <div className="text-slate-500">{selected.node_type_name}</div>
              <pre className="overflow-auto rounded bg-slate-50 p-2 text-xs">{JSON.stringify(selected.properties || {}, null, 2)}</pre>
            </div>
          ) : <p className="text-sm text-slate-500">Select a node to view details.</p>}
        </div>
      </div>

      <Modal open={addModal} title="Add Node" onClose={() => setAddModal(false)}>
        <div className="space-y-3">
          <select className="w-full rounded-lg border px-3 py-2 text-sm" value={addForm.node_type_id} onChange={(e) => setAddForm({ ...addForm, node_type_id: e.target.value })}>
            {allowedTypes.map((t) => <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>)}
          </select>
          <input className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Display name" value={addForm.display_name} onChange={(e) => setAddForm({ ...addForm, display_name: e.target.value })} />
          <button type="button" onClick={saveAdd} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save</button>
        </div>
      </Modal>

      <Modal open={editModal} title="Edit Node" onClose={() => setEditModal(false)}>
        <div className="space-y-3">
          <input className="w-full rounded-lg border px-3 py-2 text-sm" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
          {propertyDefs.map((def) => (
            <div key={def.property_definition_id}>
              <label className="mb-1 block text-xs text-slate-500">{def.display_label}</label>
              <PropertyFieldRenderer
                definition={def}
                value={editForm.properties?.[def.property_code]}
                onChange={(val) => setEditForm({ ...editForm, properties: { ...editForm.properties, [def.property_code]: val } })}
              />
            </div>
          ))}
          <CustomPropertiesEditor
            properties={editForm.properties}
            definedCodes={propertyDefs.map((d) => d.property_code)}
            onChange={(properties) => setEditForm({ ...editForm, properties })}
          />
          <button type="button" onClick={saveEdit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Save</button>
        </div>
      </Modal>

      <Modal open={submitModal} title="Submit for Approval" onClose={() => setSubmitModal(false)} wide>
        <div className="space-y-3">
          <textarea className="w-full rounded-lg border px-3 py-2 text-sm" placeholder="Reason / comments" value={submitForm.comment} onChange={(e) => setSubmitForm({ ...submitForm, comment: e.target.value })} />
          <div className="space-y-2">
            <div className="text-sm font-medium">Approval Steps</div>
            {submitForm.approval_steps.map((step, idx) => (
              <div key={idx} className="flex gap-2">
                <input className="w-16 rounded-lg border px-2 py-1 text-sm" value={step.step_sequence} readOnly />
                <input className="flex-1 rounded-lg border px-3 py-2 text-sm" value={step.approver_role_or_user} onChange={(e) => {
                  const steps = [...submitForm.approval_steps];
                  steps[idx].approver_role_or_user = e.target.value;
                  setSubmitForm({ ...submitForm, approval_steps: steps });
                }} />
              </div>
            ))}
            <button type="button" className="text-sm text-blue-600" onClick={() => setSubmitForm({ ...submitForm, approval_steps: [...submitForm.approval_steps, { step_sequence: submitForm.approval_steps.length + 1, approver_role_or_user: '' }] })}>+ Add step</button>
          </div>
          <button type="button" onClick={handleSubmit} className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white">Submit</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteNode} title="Delete Node" message={`Remove "${deleteNode?.display_name}" and its subtree?`} onConfirm={handleDelete} onCancel={() => setDeleteNode(null)} confirmLabel="Delete" danger />
    </div>
  );
}
