import CustomPropertiesEditor from '../CustomPropertiesEditor';
import PropertyFieldRenderer from '../PropertyFieldRenderer';
import Modal, { ModalFooter } from '../Modal';
import Button from '../ui/Button';
import FormField from '../ui/FormField';
import Input from '../ui/Input';
import Select from '../ui/Select';
import { formatPropertyValue, getCustomPropertyEntries } from '../../utils/nodeProperties';

/** JSON-array-of-objects properties rendered as a table instead of a raw JSON string. */
const TABLE_PROPERTY_CONFIG = {
  reps: {
    label: 'Sales Reps',
    columns: [
      { key: 'full_name', label: 'Name' },
      { key: 'job_title', label: 'Job Title' },
      { key: 'department', label: 'Department' },
      { key: 'commission_flag', label: 'Commission' },
      { key: 'email', label: 'Email' },
      { key: 'effective_date', label: 'Effective Date' },
    ],
  },
  transactions: {
    label: 'Transactions',
    columns: [
      { key: 'trx_book_date', label: 'Date' },
      { key: 'product_id', label: 'Product' },
      { key: 'trx_source', label: 'Source' },
      { key: 'qty', label: 'Qty' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'trx_value', label: 'Value' },
      { key: 'trx_currency', label: 'Currency' },
    ],
  },
};

function parseTableRows(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function PropertyTable({ label, columns, rows }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">{label}</div>
        <div className="text-[10px] text-[var(--color-text-muted)]">{rows.length} record{rows.length === 1 ? '' : 's'}</div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[12px]">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
              {columns.map((col) => (
                <th key={col.key} className="whitespace-nowrap px-2 py-1 font-medium">{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-[var(--color-border)] last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-2 py-1">{formatPropertyValue(row[col.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

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
  const tableEntries = getCustomPropertyEntries(form.properties, propertyDefs, { includeTableOnly: true }).filter(
    ([key]) => TABLE_PROPERTY_CONFIG[key] && parseTableRows(form.properties?.[key]),
  );

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
          {tableEntries.map(([key, value]) => (
            <PropertyTable
              key={key}
              label={TABLE_PROPERTY_CONFIG[key].label}
              columns={TABLE_PROPERTY_CONFIG[key].columns}
              rows={parseTableRows(value)}
            />
          ))}
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
