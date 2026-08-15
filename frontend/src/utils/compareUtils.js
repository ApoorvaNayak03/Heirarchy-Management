export const LEGEND = [
  { key: 'Added', label: 'Added', icon: '+', iconClass: 'compare-change-icon--added', legendClass: 'compare-legend-icon--added' },
  { key: 'Removed', label: 'Removed', icon: '−', iconClass: 'compare-change-icon--removed', legendClass: 'compare-legend-icon--removed' },
  { key: 'Moved', label: 'Moved', icon: '→', iconClass: 'compare-change-icon--moved', legendClass: 'compare-legend-icon--moved' },
  { key: 'Changed', label: 'Changed', icon: '□', iconClass: 'compare-change-icon--changed', legendClass: 'compare-legend-icon--changed' },
  { key: 'Unchanged', label: 'Unchanged', icon: '', iconClass: '', legendClass: 'compare-legend-icon--unchanged' },
];

const STYLE_BY_KEY = Object.fromEntries(LEGEND.map((l) => [l.key, l]));

export function buildDiffMap(changes) {
  const map = {};
  for (const c of changes || []) {
    if (!c.hierarchy_node_id) continue;
    if (!map[c.hierarchy_node_id]) map[c.hierarchy_node_id] = [];
    const type = c.change_type === 'Renamed' || c.change_type === 'Property' ? 'Changed' : c.change_type;
    if (!map[c.hierarchy_node_id].includes(type)) {
      map[c.hierarchy_node_id].push(type);
    }
  }
  return map;
}

function primaryDiffType(diffTypes, side) {
  if (!diffTypes?.length) return null;
  const visible = diffTypes.filter((t) => {
    if (side === 'a' && t === 'Added') return false;
    if (side === 'b' && t === 'Removed') return false;
    return true;
  });
  if (!visible.length) return side === 'a' ? 'Removed' : 'Added';

  const order = ['Removed', 'Added', 'Moved', 'Changed'];
  for (const t of order) {
    if (visible.includes(t)) return t;
  }
  return visible[0];
}

export function getNodeDiff(diffTypes, side) {
  const type = primaryDiffType(diffTypes, side);
  if (!type) return STYLE_BY_KEY.Unchanged;
  return STYLE_BY_KEY[type] || STYLE_BY_KEY.Changed;
}

export function matchesFilter(diffTypes, side, filter) {
  if (filter === 'All') return true;
  if (!diffTypes?.length) return filter === 'Unchanged';
  const type = primaryDiffType(diffTypes, side);
  if (filter === 'Unchanged') return !type;
  if (filter === 'Changed') return type === 'Changed';
  return type === filter;
}
