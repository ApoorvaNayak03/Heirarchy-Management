from __future__ import annotations

from collections import defaultdict, deque

from sqlalchemy.orm import Session

from app.models import HierarchyEdge, HierarchyVersionNode
from app.utils.enums import NodeStatus


def would_create_cycle(
    db: Session,
    version_id: str,
    child_version_node_id: str,
    new_parent_version_node_id: str | None,
) -> bool:
    if new_parent_version_node_id is None:
        return False
    if child_version_node_id == new_parent_version_node_id:
        return True

    adjacency: dict[str, list[str]] = defaultdict(list)
    edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id).all()
    for edge in edges:
        if edge.parent_version_node_id:
            adjacency[edge.parent_version_node_id].append(edge.child_version_node_id)

    adjacency[new_parent_version_node_id].append(child_version_node_id)

    visited = set()
    queue = deque([child_version_node_id])
    while queue:
        current = queue.popleft()
        if current == new_parent_version_node_id:
            return True
        if current in visited:
            continue
        visited.add(current)
        for child in adjacency.get(current, []):
            queue.append(child)
    return False


def get_active_version_nodes(db: Session, version_id: str) -> list[HierarchyVersionNode]:
    return (
        db.query(HierarchyVersionNode)
        .filter(
            HierarchyVersionNode.hierarchy_version_id == version_id,
            HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
        )
        .all()
    )


def get_child_edges(db: Session, version_id: str) -> list[HierarchyEdge]:
    return db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id).all()
