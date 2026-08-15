export function buildNodeTypePreview(items, draftForm) {
  const sorted = [...items].sort((a, b) => a.display_order - b.display_order);
  if (draftForm?.name?.trim() || draftForm?.code?.trim()) {
    sorted.push({
      node_type_id: '__draft__',
      code: draftForm.code.trim() || 'CODE',
      name: draftForm.name.trim() || 'New node type',
      description: draftForm.description?.trim() || '',
      display_order: items.length + 1,
      isDraft: true,
    });
  }
  return sorted;
}

export function buildPropertyPreview(nodeTypes, properties, draftForm) {
  const sortedTypes = [...nodeTypes].sort((a, b) => a.display_order - b.display_order);

  return sortedTypes.map((type) => {
    const typeProperties = properties.filter((p) => p.node_type_id === type.node_type_id);
    const draftForType = draftForm?.node_type_id === type.node_type_id
      && (draftForm.property_code?.trim() || draftForm.display_label?.trim())
      ? [{
        property_definition_id: '__draft__',
        property_code: draftForm.property_code.trim() || 'property_code',
        display_label: draftForm.display_label.trim() || 'New property',
        data_type: draftForm.data_type || 'STRING',
        required: !!draftForm.required,
        isDraft: true,
      }]
      : [];

    return {
      ...type,
      properties: [...typeProperties, ...draftForType],
    };
  });
}

export function buildStructuralRulesPreview(nodeTypes, rules, draftForm) {
  const edges = rules.map((rule) => ({
    id: rule.structural_rule_id,
    parentId: rule.parent_node_type_id,
    childId: rule.child_node_type_id,
    parentName: rule.parent_node_type_name,
    childName: rule.child_node_type_name,
    isDraft: false,
  }));

  if (draftForm?.parent_node_type_id && draftForm?.child_node_type_id) {
    const parent = nodeTypes.find((t) => t.node_type_id === draftForm.parent_node_type_id);
    const child = nodeTypes.find((t) => t.node_type_id === draftForm.child_node_type_id);
    edges.push({
      id: '__draft__',
      parentId: draftForm.parent_node_type_id,
      childId: draftForm.child_node_type_id,
      parentName: parent?.name || 'Parent',
      childName: child?.name || 'Child',
      isDraft: true,
    });
  }

  return { nodeTypes: [...nodeTypes].sort((a, b) => a.display_order - b.display_order), edges };
}

export function schemaGraphElements({ nodeTypes, edges }) {
  const NODE_W = 180;
  const V_GAP = 90;

  const nodes = nodeTypes.map((type, idx) => ({
    id: type.node_type_id,
    type: 'schemaNode',
    position: { x: 80, y: idx * V_GAP },
    data: {
      label: type.name,
      code: type.code,
      order: type.display_order,
      isDraft: !!type.isDraft,
    },
  }));

  const flowEdges = edges.map((edge) => ({
    id: edge.id,
    source: edge.parentId,
    target: edge.childId,
    type: 'smoothstep',
    animated: !!edge.isDraft,
    label: edge.isDraft ? 'preview' : '',
    style: edge.isDraft
      ? { stroke: '#93c5fd', strokeDasharray: '6 4' }
      : { stroke: '#64748b' },
    labelStyle: { fontSize: 10, fill: '#2563eb' },
  }));

  return { nodes, edges: flowEdges };
}
