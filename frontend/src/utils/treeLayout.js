const NODE_WIDTH = 200;
const NODE_HEIGHT = 72;
const H_GAP = 48;
const V_GAP = 100;

function countLeaves(node) {
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function walkTree(nodeList, depth, startX, nodes, edges, options) {
  let x = startX;

  for (const node of nodeList) {
    const leaves = countLeaves(node);
    const nodeX = x + ((leaves - 1) * (NODE_WIDTH + H_GAP)) / 2;

    nodes.push({
      id: node.version_node_id,
      type: 'hierarchyNode',
      position: { x: nodeX, y: depth * (NODE_HEIGHT + V_GAP) },
      data: {
        label: node.display_name,
        nodeType: node.node_type_name,
        isDraft: !!node.isDraft,
        isDropTarget: options.dropTargetId === node.version_node_id,
        node,
        selectedId: options.selectedId,
        readOnly: options.readOnly,
        onSelect: options.onSelect,
        onAdd: options.onAdd,
        onEdit: options.onEdit,
        onDelete: options.onDelete,
        onClone: options.onClone,
      },
    });

    if (node.children?.length) {
      let childX = x;
      for (const child of node.children) {
        edges.push({
          id: `${node.version_node_id}-${child.version_node_id}`,
          source: node.version_node_id,
          target: child.version_node_id,
          type: 'smoothstep',
          animated: !!child.isDraft,
          style: child.isDraft
            ? { stroke: '#93c5fd', strokeDasharray: '6 4' }
            : { stroke: '#cbd5e1' },
        });
        childX = walkTree([child], depth + 1, childX, nodes, edges, options);
      }
    }

    x += leaves * (NODE_WIDTH + H_GAP);
  }

  return x;
}

export function treeToFlowElements(tree, options = {}) {
  if (!tree?.length) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  walkTree(tree, 0, 0, nodes, edges, options);
  return { nodes, edges };
}

export { NODE_HEIGHT, NODE_WIDTH };
