import CustomPropertiesEditor from '../CustomPropertiesEditor';
import PropertyFieldRenderer from '../PropertyFieldRenderer';
import Modal, { ModalFooter } from '../Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { formatPropertyValue, getCustomPropertyEntries } from '../../utils/nodeProperties';

export default function NodeDetailModal({
  open,
  mode,
  readOnly,
  parentNode,
  selectedNode,
  form,
  allowedTypes,
  propertyDefs,
  onChange,
  onSave,
  onClose,
  saving,
  customFieldsRef,
}) {
  const isAdd = mode === 'add';
  const title = isAdd
    ? parentNode
      ? `Add under "${parentNode.display_name}"`
      : 'Add root node'
    : readOnly
      ? selectedNode?.display_name
      : `Edit "${selectedNode?.display_name}"`;

  const customEntries = getCustomPropertyEntries(form.properties, propertyDefs);

  return (
    <Modal open={open} title={title} onClose={onClose} wide>
      {readOnly ? (
        <div className="max-h-[60vh] space-y-3 overflow-y-auto">
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Type</div>
            <div className="mt-0.5 text-sm font-medium">{selectedNode?.node_type_name}</div>
          </div>
          <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Name</div>
            <div className="mt-0.5 text-sm font-medium">{selectedNode?.display_name}</div>
          </div>
          {propertyDefs.map((def) => (
            <div key={def.property_definition_id} className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{def.display_label}</div>
              <div className="mt-0.5 text-sm">{formatPropertyValue(form.properties?.[def.property_code])}</div>
            </div>
          ))}
          {customEntries.length > 0 && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Additional fields</div>
              <div className="space-y-2">
                {customEntries.map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-mono text-[12px] text-[var(--color-text-muted)]">{key}</span>
                    <span className="font-medium">{formatPropertyValue(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="max-h-[60vh] space-y-4 overflow-y-auto">
          {isAdd ? (
            <FormField label="Node type" required hint={parentNode ? 'Allowed child types for this parent' : 'Root-level types only'}>
              <Select
                value={form.node_type_id}
                onChange={(e) => onChange({ node_type_id: e.target.value, properties: {} })}
              >
                {allowedTypes.map((t) => (
                  <option key={t.node_type_id} value={t.node_type_id}>{t.name}</option>
                ))}
              </Select>
            </FormField>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">Node type</div>
              <div className="mt-0.5 text-sm font-medium">{selectedNode?.node_type_name}</div>
            </div>
          )}
          <FormField label="Display name" required>
            <Input
              value={form.display_name}
              onChange={(e) => onChange({ display_name: e.target.value })}
              placeholder="e.g. North America"
              autoFocus
            />
          </FormField>
          {propertyDefs.map((def) => (
            <FormField key={def.property_definition_id} label={def.display_label} required={def.required}>
              <PropertyFieldRenderer
                definition={def}
                value={form.properties?.[def.property_code]}
                onChange={(val) => onChange({ propertyCode: def.property_code, propertyValue: val })}
              />
            </FormField>
          ))}
          <CustomPropertiesEditor
            key={selectedNode?.version_node_id || 'add'}
            ref={customFieldsRef}
            properties={form.properties}
            definedCodes={propertyDefs.map((d) => d.property_code)}
            onChange={(properties) => onChange({ properties })}
          />
        </div>
      )}

      {!readOnly && (
        <ModalFooter>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={onSave} disabled={saving || !form.display_name?.trim()}>
            {saving ? 'Saving…' : isAdd ? 'Add node' : 'Save'}
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
