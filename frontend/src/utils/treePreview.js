export function injectDraftNode(tree, parentId, draftNode) {
  if (!parentId) return [...tree, draftNode];

  return tree.map((node) => {
    if (node.version_node_id === parentId) {
      return { ...node, children: [...(node.children || []), draftNode] };
    }
    if (node.children?.length) {
      return { ...node, children: injectDraftNode(node.children, parentId, draftNode) };
    }
    return node;
  });
}

export function buildPreviewTree(tree, { mode, addForm, allowedTypes, parentForAdd }) {
  if (mode !== 'add' || !addForm.display_name?.trim()) return tree;

  const typeName = allowedTypes.find((t) => t.node_type_id === addForm.node_type_id)?.name || 'New node';

  const draftNode = {
    version_node_id: '__draft__',
    display_name: addForm.display_name.trim(),
    node_type_name: typeName,
    node_type_id: addForm.node_type_id,
    properties: addForm.properties || {},
    isDraft: true,
    children: [],
  };

  return injectDraftNode(tree, parentForAdd?.version_node_id || null, draftNode);
}
