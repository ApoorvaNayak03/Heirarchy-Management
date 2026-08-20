/** Keys stored on the node but not in the schema property definitions. */
export function getCustomPropertyEntries(properties = {}, propertyDefs = []) {
  const definedCodes = new Set(propertyDefs.map((d) => d.property_code));
  return Object.entries(properties || {}).filter(([key]) => !definedCodes.has(key));
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
