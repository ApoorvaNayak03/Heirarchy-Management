from __future__ import annotations

import json
import uuid
from collections import defaultdict

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.dependencies import assert_version_editable, serialize_value
from app.models import (
    Hierarchy,
    HierarchyCopyLineage,
    HierarchyEdge,
    HierarchyNode,
    HierarchyVersion,
    HierarchyVersionNode,
    NodeType,
    User,
)
from app.schemas.schemas import (
    CopySubtreeRequest,
    NodeCloneRequest,
    NodeCreate,
    NodeMoveRequest,
    NodeUpdate,
    TreeNodeResponse,
)
from app.services.audit_service import AuditService
from app.utils.cycle import get_active_version_nodes, get_child_edges, would_create_cycle
from app.utils.enums import ChangeAction, ChangeEntityType, LineageOperationType, NodeStatus
from app.validators.validation_service import PropertyValidator, ValidationService


class NodeService:
    @staticmethod
    def build_tree(db: Session, version_id: str) -> list[TreeNodeResponse]:
        version = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")

        nodes = (
            db.query(HierarchyVersionNode)
            .options(joinedload(HierarchyVersionNode.hierarchy_node).joinedload(HierarchyNode.node_type))
            .filter(
                HierarchyVersionNode.hierarchy_version_id == version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
            .order_by(HierarchyVersionNode.sibling_order)
            .all()
        )
        edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id).all()

        children_map: dict[str | None, list[str]] = defaultdict(list)
        parent_map: dict[str, str | None] = {}
        for edge in edges:
            child_id = edge.child_version_node_id
            parent_id = edge.parent_version_node_id
            if parent_id:
                children_map[parent_id].append(child_id)
            else:
                children_map[None].append(child_id)
            if not version.hierarchy.hierarchy_type.allow_multiple_parents:
                parent_map[child_id] = parent_id

        node_lookup = {n.version_node_id: n for n in nodes}

        def build_node(vn: HierarchyVersionNode) -> TreeNodeResponse:
            node_type = vn.hierarchy_node.node_type
            return TreeNodeResponse(
                version_node_id=vn.version_node_id,
                hierarchy_node_id=vn.hierarchy_node_id,
                display_name=vn.display_name,
                node_type_id=node_type.node_type_id,
                node_type_code=node_type.code,
                node_type_name=node_type.name,
                sibling_order=vn.sibling_order,
                node_status=vn.node_status,
                properties=vn.properties or {},
                parent_version_node_id=parent_map.get(vn.version_node_id),
                children=[
                    build_node(node_lookup[cid])
                    for cid in children_map.get(vn.version_node_id, [])
                    if cid in node_lookup
                ],
            )

        roots = [node_lookup[cid] for cid in children_map.get(None, []) if cid in node_lookup]
        if not roots:
            roots = [n for n in nodes if n.version_node_id not in parent_map and n.version_node_id not in [e.child_version_node_id for e in edges if e.parent_version_node_id]]
            if not roots:
                roots = nodes
        return [build_node(r) for r in roots]

    @staticmethod
    def add_node(db: Session, version_id: str, payload: NodeCreate, user: User) -> HierarchyVersionNode:
        version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        assert_version_editable(version.status)

        hierarchy_type = version.hierarchy.hierarchy_type
        parent_vn = None
        if payload.parent_version_node_id:
            parent_vn = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == payload.parent_version_node_id).first()
            if not parent_vn:
                raise HTTPException(status_code=404, detail="Parent node not found")

        ValidationService.validate_parent_child(db, hierarchy_type, parent_vn, payload.node_type_id, version_id)

        node_type = db.query(NodeType).filter(NodeType.node_type_id == payload.node_type_id).first()
        if not node_type:
            raise HTTPException(status_code=404, detail="Node type not found")

        stable_code = payload.stable_code or f"{node_type.code}-{uuid.uuid4().hex[:8]}"
        logical = HierarchyNode(
            hierarchy_node_id=str(uuid.uuid4()),
            hierarchy_id=version.hierarchy_id,
            node_type_id=payload.node_type_id,
            stable_code=stable_code,
            created_by=user.username,
        )
        db.add(logical)
        db.flush()

        properties = payload.properties or {}
        prop_errors = PropertyValidator.validate_properties(db, hierarchy_type.hierarchy_type_id, payload.node_type_id, properties)
        if prop_errors:
            raise HTTPException(status_code=400, detail={"errors": [e.model_dump() for e in prop_errors]})

        vn = HierarchyVersionNode(
            version_node_id=str(uuid.uuid4()),
            hierarchy_version_id=version_id,
            hierarchy_node_id=logical.hierarchy_node_id,
            display_name=payload.display_name,
            sibling_order=payload.sibling_order,
            properties=properties,
        )
        db.add(vn)
        db.flush()

        edge = HierarchyEdge(
            edge_id=str(uuid.uuid4()),
            hierarchy_version_id=version_id,
            child_version_node_id=vn.version_node_id,
            parent_version_node_id=payload.parent_version_node_id,
        )
        db.add(edge)

        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version_id,
            entity_type=ChangeEntityType.VERSION_NODE,
            entity_id=vn.version_node_id,
            action=ChangeAction.CREATE,
            changed_by=user.username,
            new_value=payload.display_name,
        )
        db.commit()
        db.refresh(vn)
        return vn

    @staticmethod
    def update_node(db: Session, version_id: str, version_node_id: str, payload: NodeUpdate, user: User) -> HierarchyVersionNode:
        version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        assert_version_editable(version.status)
        vn = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == version_node_id, HierarchyVersionNode.hierarchy_version_id == version_id).first()
        if not vn:
            raise HTTPException(status_code=404, detail="Node not found")

        if payload.properties is not None:
            errors = PropertyValidator.validate_properties(
                db,
                version.hierarchy.hierarchy_type_id,
                vn.hierarchy_node.node_type_id,
                payload.properties,
                version_node_id,
            )
            if errors:
                raise HTTPException(status_code=400, detail={"errors": [e.model_dump() for e in errors]})

        for field, value in payload.model_dump(exclude_unset=True).items():
            old = getattr(vn, field)
            setattr(vn, field, value)
            AuditService.log_change(
                db,
                hierarchy_id=version.hierarchy_id,
                hierarchy_version_id=version_id,
                entity_type=ChangeEntityType.PROPERTY if field == "properties" else ChangeEntityType.VERSION_NODE,
                entity_id=version_node_id,
                action=ChangeAction.UPDATE,
                changed_by=user.username,
                field_name=field,
                old_value=serialize_value(old),
                new_value=serialize_value(value),
            )
        db.commit()
        db.refresh(vn)
        return vn

    @staticmethod
    def delete_node(db: Session, version_id: str, version_node_id: str, user: User) -> None:
        version = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        assert_version_editable(version.status)

        def remove_subtree(vn_id: str):
            child_edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id, HierarchyEdge.parent_version_node_id == vn_id).all()
            for ce in child_edges:
                remove_subtree(ce.child_version_node_id)
            vn = db.query(HierarchyVersionNode).filter(HierarchyVersionNode.version_node_id == vn_id).first()
            if vn:
                vn.node_status = NodeStatus.REMOVED.value
                AuditService.log_change(
                    db,
                    hierarchy_id=version.hierarchy_id,
                    hierarchy_version_id=version_id,
                    entity_type=ChangeEntityType.VERSION_NODE,
                    entity_id=vn_id,
                    action=ChangeAction.DELETE,
                    changed_by=user.username,
                )
            db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id, HierarchyEdge.child_version_node_id == vn_id).delete()

        remove_subtree(version_node_id)
        db.commit()

    @staticmethod
    def move_node(db: Session, version_id: str, version_node_id: str, payload: NodeMoveRequest, user: User) -> HierarchyVersionNode:
        version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        assert_version_editable(version.status)
        vn = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == version_node_id).first()
        if not vn:
            raise HTTPException(status_code=404, detail="Node not found")

        parent_vn = None
        if payload.new_parent_version_node_id:
            parent_vn = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == payload.new_parent_version_node_id).first()

        ValidationService.validate_parent_child(
            db,
            version.hierarchy.hierarchy_type,
            parent_vn,
            vn.hierarchy_node.node_type_id,
            version_id,
            version_node_id,
            payload.new_parent_version_node_id,
            replace_existing=True,
        )

        if would_create_cycle(db, version_id, version_node_id, payload.new_parent_version_node_id):
            raise HTTPException(status_code=409, detail="Move would create a cycle in the hierarchy")

        edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id, HierarchyEdge.child_version_node_id == version_node_id).all()
        old_parent = edges[0].parent_version_node_id if edges else None
        for edge in edges:
            edge.parent_version_node_id = payload.new_parent_version_node_id
        if not edges:
            db.add(
                HierarchyEdge(
                    edge_id=str(uuid.uuid4()),
                    hierarchy_version_id=version_id,
                    child_version_node_id=version_node_id,
                    parent_version_node_id=payload.new_parent_version_node_id,
                )
            )
        if payload.sibling_order is not None:
            vn.sibling_order = payload.sibling_order

        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version_id,
            entity_type=ChangeEntityType.EDGE,
            entity_id=version_node_id,
            action=ChangeAction.MOVE,
            changed_by=user.username,
            old_value=str(old_parent),
            new_value=str(payload.new_parent_version_node_id),
        )
        db.commit()
        db.refresh(vn)
        return vn

    @staticmethod
    def clone_node(db: Session, version_id: str, version_node_id: str, payload: NodeCloneRequest, user: User) -> HierarchyVersionNode:
        version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        assert_version_editable(version.status)
        source = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == version_node_id).first()
        if not source:
            raise HTTPException(status_code=404, detail="Source node not found")

        parent_edge = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id, HierarchyEdge.child_version_node_id == version_node_id).first()
        node_type_id = source.hierarchy_node.node_type_id
        stable_code = payload.stable_code or f"clone-{uuid.uuid4().hex[:8]}"
        logical = HierarchyNode(
            hierarchy_node_id=str(uuid.uuid4()),
            hierarchy_id=version.hierarchy_id,
            node_type_id=node_type_id,
            stable_code=stable_code,
            created_by=user.username,
        )
        db.add(logical)
        db.flush()

        properties = payload.properties if payload.properties is not None else (source.properties.copy() if source.properties else {})
        new_vn = HierarchyVersionNode(
            version_node_id=str(uuid.uuid4()),
            hierarchy_version_id=version_id,
            hierarchy_node_id=logical.hierarchy_node_id,
            display_name=payload.display_name,
            sibling_order=source.sibling_order + 1,
            properties=properties,
        )
        db.add(new_vn)
        db.flush()
        db.add(
            HierarchyEdge(
                edge_id=str(uuid.uuid4()),
                hierarchy_version_id=version_id,
                child_version_node_id=new_vn.version_node_id,
                parent_version_node_id=parent_edge.parent_version_node_id if parent_edge else None,
            )
        )
        db.add(
            HierarchyCopyLineage(
                lineage_id=str(uuid.uuid4()),
                target_version_node_id=new_vn.version_node_id,
                source_hierarchy_version_id=version_id,
                source_version_node_id=version_node_id,
                operation_type=LineageOperationType.CLONE.value,
                created_by=user.username,
            )
        )
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version_id,
            entity_type=ChangeEntityType.VERSION_NODE,
            entity_id=new_vn.version_node_id,
            action=ChangeAction.COPY,
            changed_by=user.username,
            new_value=payload.display_name,
        )
        db.commit()
        db.refresh(new_vn)
        return new_vn

    @staticmethod
    def copy_subtree(db: Session, target_version_id: str, payload: CopySubtreeRequest, user: User) -> TreeNodeResponse:
        target_version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == target_version_id).first()
        assert_version_editable(target_version.status)

        source_nodes = get_active_version_nodes(db, payload.source_version_id)
        source_edges = get_child_edges(db, payload.source_version_id)
        source_lookup = {n.version_node_id: n for n in source_nodes}

        if payload.source_version_node_id not in source_lookup:
            raise HTTPException(status_code=404, detail="Source subtree root not found")

        subtree_ids = set()

        def collect(vn_id: str):
            subtree_ids.add(vn_id)
            for edge in source_edges:
                if edge.parent_version_node_id == vn_id:
                    collect(edge.child_version_node_id)

        collect(payload.source_version_node_id)
        node_map: dict[str, str] = {}

        for sid in subtree_ids:
            src = source_lookup[sid]
            logical = HierarchyNode(
                hierarchy_node_id=str(uuid.uuid4()),
                hierarchy_id=target_version.hierarchy_id,
                node_type_id=src.hierarchy_node.node_type_id,
                stable_code=f"copy-{uuid.uuid4().hex[:8]}",
                created_by=user.username,
            )
            db.add(logical)
            db.flush()
            new_vn = HierarchyVersionNode(
                version_node_id=str(uuid.uuid4()),
                hierarchy_version_id=target_version_id,
                hierarchy_node_id=logical.hierarchy_node_id,
                display_name=src.display_name,
                sibling_order=src.sibling_order,
                properties=src.properties.copy() if src.properties else {},
            )
            db.add(new_vn)
            db.flush()
            node_map[sid] = new_vn.version_node_id
            db.add(
                HierarchyCopyLineage(
                    lineage_id=str(uuid.uuid4()),
                    target_version_node_id=new_vn.version_node_id,
                    source_hierarchy_version_id=payload.source_version_id,
                    source_version_node_id=sid,
                    operation_type=LineageOperationType.COPY_SUBTREE.value,
                    created_by=user.username,
                )
            )

        for edge in source_edges:
            if edge.child_version_node_id in subtree_ids:
                parent_id = edge.parent_version_node_id
                mapped_parent = payload.target_parent_version_node_id if edge.child_version_node_id == payload.source_version_node_id else node_map.get(parent_id)
                if edge.child_version_node_id == payload.source_version_node_id:
                    mapped_parent = payload.target_parent_version_node_id
                elif parent_id in node_map:
                    mapped_parent = node_map[parent_id]
                else:
                    continue
                db.add(
                    HierarchyEdge(
                        edge_id=str(uuid.uuid4()),
                        hierarchy_version_id=target_version_id,
                        child_version_node_id=node_map[edge.child_version_node_id],
                        parent_version_node_id=mapped_parent,
                    )
                )

        db.commit()
        tree = NodeService.build_tree(db, target_version_id)
        return tree[0] if tree else TreeNodeResponse(
            version_node_id="",
            hierarchy_node_id="",
            display_name="",
            node_type_id="",
            node_type_code="",
            node_type_name="",
            sibling_order=0,
            node_status=NodeStatus.ACTIVE.value,
            properties={},
        )

    @staticmethod
    def get_root_eligible_type_ids(db: Session, hierarchy_type_id: str) -> set[str]:
        from app.models import StructuralRule
        from app.utils.enums import EntityStatus

        rules = (
            db.query(StructuralRule)
            .filter(
                StructuralRule.hierarchy_type_id == hierarchy_type_id,
                StructuralRule.status == EntityStatus.ACTIVE.value,
            )
            .all()
        )
        active_types = (
            db.query(NodeType)
            .filter(
                NodeType.hierarchy_type_id == hierarchy_type_id,
                NodeType.status == EntityStatus.ACTIVE.value,
            )
            .all()
        )
        if not rules:
            return {nt.node_type_id for nt in active_types}

        child_type_ids = {r.child_node_type_id for r in rules}
        return {nt.node_type_id for nt in active_types if nt.node_type_id not in child_type_ids}

    @staticmethod
    def get_allowed_child_types(db: Session, version_id: str, parent_version_node_id: str | None) -> list[NodeType]:
        version = db.query(HierarchyVersion).options(joinedload(HierarchyVersion.hierarchy)).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        from app.models import StructuralRule
        from app.utils.enums import EntityStatus

        if parent_version_node_id is None:
            root_type_ids = NodeService.get_root_eligible_type_ids(db, version.hierarchy.hierarchy_type_id)
            return (
                db.query(NodeType)
                .filter(NodeType.node_type_id.in_(root_type_ids))
                .order_by(NodeType.display_order)
                .all()
            )

        parent = db.query(HierarchyVersionNode).options(joinedload(HierarchyVersionNode.hierarchy_node)).filter(HierarchyVersionNode.version_node_id == parent_version_node_id).first()
        parent_type_id = parent.hierarchy_node.node_type_id
        child_type_ids = {
            r.child_node_type_id
            for r in db.query(StructuralRule).filter(
                StructuralRule.hierarchy_type_id == version.hierarchy.hierarchy_type_id,
                StructuralRule.parent_node_type_id == parent_type_id,
                StructuralRule.status == EntityStatus.ACTIVE.value,
            )
        }
        return db.query(NodeType).filter(NodeType.node_type_id.in_(child_type_ids)).order_by(NodeType.display_order).all()
