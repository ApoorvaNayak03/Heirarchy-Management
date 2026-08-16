import { findNode, flattenTree, isDescendant } from './treeUtils';

/** Resolve drag target into parent id and sibling order (mirrors handleMove). */
export function resolveMoveTarget(draggedId, targetRef, position, tree) {
  const flat = flattenTree(tree);

  if (targetRef === null || targetRef === undefined) {
    return { newParentId: null, siblingOrder: 0 };
  }

  if (position === 'before' || position === 'after') {
    const target = flat.find((n) => n.version_node_id === targetRef);
    if (!target) return null;
    return {
      newParentId: target.parentId,
      siblingOrder: position === 'before' ? target.siblingIndex : target.siblingIndex + 1,
    };
  }

  const targetNode = findNode(tree, targetRef);
  if (!targetNode) return null;
  return {
    newParentId: targetRef,
    siblingOrder: targetNode.children?.length || 0,
  };
}

/** Block self-parent and descendant-parent moves. */
export function isMoveTopologicallyValid(draggedId, newParentId, tree) {
  if (!draggedId) return false;
  if (newParentId === draggedId) return false;
  if (newParentId && isDescendant(tree, draggedId, newParentId)) return false;
  return true;
}

const ACTIVE = 'ACTIVE';

/** Build a synchronous move validator from hierarchy detail schema data. */
export function buildMoveValidator(nodeTypes = [], structuralRules = []) {
  const activeRules = structuralRules.filter((r) => (r.status || ACTIVE) === ACTIVE);
  const activeTypeIds = new Set(
    nodeTypes.filter((nt) => (nt.status || ACTIVE) === ACTIVE).map((nt) => nt.node_type_id),
  );
  const childTypeIdsInRules = new Set(activeRules.map((r) => r.child_node_type_id));

  function getRootEligibleTypeIds() {
    if (activeRules.length === 0) return activeTypeIds;
    return new Set([...activeTypeIds].filter((id) => !childTypeIdsInRules.has(id)));
  }

  function isAllowedUnderParent(parentNodeTypeId, childNodeTypeId) {
    if (parentNodeTypeId == null) {
      return getRootEligibleTypeIds().has(childNodeTypeId);
    }
    return activeRules.some(
      (r) => r.parent_node_type_id === parentNodeTypeId && r.child_node_type_id === childNodeTypeId,
    );
  }

  return function validateMove(draggedNode, newParentId, tree) {
    if (!draggedNode) {
      return { valid: false, reason: 'Node not found' };
    }

    if (!isMoveTopologicallyValid(draggedNode.version_node_id, newParentId, tree)) {
      return { valid: false, reason: "Can't move a node under itself or its descendant" };
    }

    const parentNode = newParentId ? findNode(tree, newParentId) : null;
    const parentTypeId = parentNode?.node_type_id ?? null;

    if (!isAllowedUnderParent(parentTypeId, draggedNode.node_type_id)) {
      if (newParentId == null) {
        return { valid: false, reason: 'This node type cannot be used as a root node' };
      }
      return { valid: false, reason: 'The selected parent does not allow this node type' };
    }

    return { valid: true };
  };
}

/** Convenience: resolve target then validate in one call. */
export function checkMove(draggedId, targetRef, position, tree, validateMove) {
  const draggedNode = findNode(tree, draggedId);
  const resolved = resolveMoveTarget(draggedId, targetRef, position, tree);
  if (!resolved) {
    return { valid: false, reason: 'Invalid drop target' };
  }
  return validateMove(draggedNode, resolved.newParentId, tree);
}
