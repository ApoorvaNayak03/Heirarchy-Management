import { GitBranchPlus, Network, Pencil, TreePine } from 'lucide-react';
import CustomPropertiesEditor from './CustomPropertiesEditor';
import PropertyFieldRenderer from './PropertyFieldRenderer';
import Button from './ui/Button';
import FormField from './ui/FormField';
import Input from './ui/Input';
import Select from './ui/Select';

export default function NodeEditorPanel({
  mode,
  readOnly,
  parentForAdd,
  selected,
  addForm,
  editForm,
  allowedTypes,
  propertyDefs,
  onAddFormChange,
  onEditFormChange,
  onSaveAdd,
  onSaveEdit,
  onCancel,
  onStartAddRoot,
  saving,
}) {
  const isAdd = mode === 'add';

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--color-border)] px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              {isAdd ? (
                <GitBranchPlus size={16} className="text-[var(--color-accent)]" />
              ) : (
                <Pencil size={16} className="text-[var(--color-accent)]" />
              )}
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                {isAdd ? (parentForAdd ? 'Add Child Node' : 'Add Root Node') : 'Edit Node'}
              </h2>
            </div>
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              {isAdd
                ? parentForAdd
                  ? `Adding under "${parentForAdd.display_name}" — preview updates as you type.`
                  : 'Create a top-level node. The tree preview updates as you type.'
                : `Editing "${selected?.display_name}". Changes sync to the tree on save.`}
            </p>
          </div>
          {!readOnly && (
            <Button variant="secondary" size="sm" onClick={onStartAddRoot}>
              New root
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {readOnly ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This version is locked. You can view the hierarchy but not make changes.
          </div>
        ) : (
          <div className="space-y-4">
            {isAdd ? (
              <>
                <FormField
                  label="Node type"
                  required
                  hint={parentForAdd
                    ? `Allowed under "${parentForAdd.display_name}"`
                    : 'Top-level types only (e.g. Category) — types that are never a child in your structural rules'}
                >
                  <Select
                    value={addForm.node_type_id}
                    onChange={(e) => onAddFormChange({ ...addForm, node_type_id: e.target.value, properties: {} })}
                  >
                    {allowedTypes.map((t) => (
                      <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Display name" required hint="Shown in the tree and graph">
                  <Input
                    value={addForm.display_name}
                    onChange={(e) => onAddFormChange({ ...addForm, display_name: e.target.value })}
                    placeholder="e.g. North America Region"
                    autoFocus
                  />
                </FormField>
                {propertyDefs.map((def) => (
                  <FormField key={def.property_definition_id} label={def.display_label} required={def.required}>
                    <PropertyFieldRenderer
                      definition={def}
                      value={addForm.properties?.[def.property_code]}
                      onChange={(val) => onAddFormChange({
                        ...addForm,
                        properties: { ...addForm.properties, [def.property_code]: val },
                      })}
                    />
                  </FormField>
                ))}
                <CustomPropertiesEditor
                  properties={addForm.properties}
                  definedCodes={propertyDefs.map((d) => d.property_code)}
                  onChange={(properties) => onAddFormChange({ ...addForm, properties })}
                />
              </>
            ) : selected ? (
              <>
                <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Node type</div>
                  <div className="mt-0.5 text-sm font-medium">{selected.node_type_name}</div>
                </div>
                <FormField label="Display name" required>
                  <Input
                    value={editForm.display_name}
                    onChange={(e) => onEditFormChange({ ...editForm, display_name: e.target.value })}
                  />
                </FormField>
                {propertyDefs.map((def) => (
                  <FormField key={def.property_definition_id} label={def.display_label} required={def.required}>
                    <PropertyFieldRenderer
                      definition={def}
                      value={editForm.properties?.[def.property_code]}
                      onChange={(val) => onEditFormChange({
                        ...editForm,
                        properties: { ...editForm.properties, [def.property_code]: val },
                      })}
                    />
                  </FormField>
                ))}
                <CustomPropertiesEditor
                  properties={editForm.properties}
                  definedCodes={propertyDefs.map((d) => d.property_code)}
                  onChange={(properties) => onEditFormChange({ ...editForm, properties })}
                />
              </>
            ) : (
              <div className="rounded-lg border border-dashed border-[var(--color-border-strong)] bg-[var(--color-bg)] px-4 py-8 text-center">
                <p className="text-sm text-[var(--color-text-secondary)]">Select a node in the tree or graph to edit it.</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">Or click &ldquo;New root&rdquo; to add a node.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {!readOnly && (
        <div className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-3">
          <div className="text-[11px] text-[var(--color-text-muted)]">
            Tip: double-click a node name in the tree to rename inline
          </div>
          <div className="flex gap-2">
            {!isAdd && selected && (
              <Button variant="secondary" onClick={onCancel}>Cancel</Button>
            )}
            {isAdd ? (
              <Button onClick={onSaveAdd} disabled={saving || !addForm.display_name?.trim()}>
                {saving ? 'Adding…' : 'Add to hierarchy'}
              </Button>
            ) : selected ? (
              <Button onClick={onSaveEdit} disabled={saving || !editForm.display_name?.trim()}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function HierarchyViewToggle({ view, onChange, nodeCount }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-accent-muted)] px-1.5 font-semibold text-[var(--color-accent)]">
          {nodeCount}
        </span>
        nodes in hierarchy
      </div>
      <div className="inline-flex rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] p-0.5">
        <button
          type="button"
          onClick={() => onChange('tree')}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            view === 'tree' ? 'bg-white text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <TreePine size={13} /> Tree
        </button>
        <button
          type="button"
          onClick={() => onChange('graph')}
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            view === 'graph' ? 'bg-white text-[var(--color-text)] shadow-sm' : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
          }`}
        >
          <Network size={13} /> Graph
        </button>
      </div>
    </div>
  );
}
