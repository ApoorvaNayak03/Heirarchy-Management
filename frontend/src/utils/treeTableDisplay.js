import { getNodePropertyDisplayItems } from '../components/NodePropertyDisplay';

/** Rollup badges + field items for a tree row. */
export function getNodeTableCells(node, propertyDefs = []) {
  const items = getNodePropertyDisplayItems(node, propertyDefs);
  return {
    rollups: items.filter((i) => i.isRollup),
    fields: items.filter((i) => !i.isRollup),
  };
}


/** Unique node types in the tree for the footer legend. */
export function collectNodeTypes(tree) {
  const types = new Map();
  const walk = (nodes) => {
    for (const node of nodes || []) {
      if (node.node_type_name) {
        types.set(node.node_type_id, node.node_type_name);
      }
      walk(node.children);
    }
  };
  walk(tree);
  return Array.from(types.entries()).map(([id, name]) => ({ id, name }));
}

/** Keep nodes matching selected types (or ancestors of matches). */
export function filterTreeByTypes(tree, typeIds) {
  if (!typeIds?.size) return tree;

  const walk = (nodes) => {
    const out = [];
    for (const node of nodes || []) {
      const children = walk(node.children);
      const match = typeIds.has(node.node_type_id);
      if (match || children.length) {
        out.push({ ...node, children });
      }
    }
    return out;
  };
  return walk(tree);
}
