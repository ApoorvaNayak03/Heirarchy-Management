/** Keys whose values are large JSON blobs (arrays of records) with their own dedicated renderer,
 * so they're excluded from generic chip/list displays and shown as a table instead. */
export const TABLE_ONLY_PROPERTY_KEYS = new Set(['reps', 'transactions']);

/** Keys stored on the node but not in the schema property definitions. */
export function getCustomPropertyEntries(properties = {}, propertyDefs = [], { includeTableOnly = false } = {}) {
  const definedCodes = new Set(propertyDefs.map((d) => d.property_code));
  return Object.entries(properties || {}).filter(
    ([key]) => !definedCodes.has(key) && (includeTableOnly || !TABLE_ONLY_PROPERTY_KEYS.has(key)),
  );
}

/** Normalize node properties for the edit form — keep all saved values. */
export function buildNodeFormState(node, propertyDefs = []) {
  const saved = { ...(node?.properties || {}) };
  return {
    display_name: node?.display_name || '',
    properties: saved,
  };
}

export function formatPropertyValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}
