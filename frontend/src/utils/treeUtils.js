/** Flatten tree for drag-and-drop and search. */
export function flattenTree(tree, parentId = null, depth = 0) {
  const result = [];
  (tree || []).forEach((node, index) => {
    result.push({
      ...node,
      parentId,
      depth,
      siblingIndex: index,
    });
    if (node.children?.length) {
      result.push(...flattenTree(node.children, node.version_node_id, depth + 1));
    }
  });
  return result;
}

export function findNode(tree, id) {
  for (const node of tree || []) {
    if (node.version_node_id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function isDescendant(tree, ancestorId, candidateId) {
  const ancestor = findNode(tree, ancestorId);
  if (!ancestor) return false;
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.version_node_id === candidateId) return true;
      if (walk(n.children)) return true;
    }
    return false;
  };
  return walk(ancestor.children);
}

export function subtreeFrom(tree, id) {
  const node = findNode(tree, id);
  return node ? [node] : [];
}

export function countNodes(tree) {
  return (tree || []).reduce((sum, node) => sum + 1 + countNodes(node.children), 0);
}

export function filterTree(tree, query) {
  const q = query.trim().toLowerCase();
  if (!q) return tree;

  const walk = (nodes) => {
    const out = [];
    for (const node of nodes || []) {
      const children = walk(node.children);
      const match =
        node.display_name?.toLowerCase().includes(q) ||
        node.node_type_name?.toLowerCase().includes(q);
      if (match || children.length) {
        out.push({ ...node, children });
      }
    }
    return out;
  };
  return walk(tree);
}
