from __future__ import annotations

import json
from collections import defaultdict

from sqlalchemy.orm import Session, joinedload

from app.models import (
    HierarchyCopyLineage,
    HierarchyEdge,
    HierarchyVersion,
    HierarchyVersionNode,
)
from app.schemas.schemas import CompareChangeItem, CompareResult, CompareSummary
from app.utils.enums import NodeStatus


class ComparisonService:
    @staticmethod
    def compare(db: Session, version_a_id: str, version_b_id: str) -> CompareResult:
        version_a = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_a_id).first()
        version_b = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_b_id).first()
        if not version_a or not version_b:
            raise ValueError("Versions not found")
        if version_a.hierarchy_id != version_b.hierarchy_id:
            raise ValueError("Versions must belong to the same hierarchy")

        nodes_a = ComparisonService._get_node_map(db, version_a_id)
        nodes_b = ComparisonService._get_node_map(db, version_b_id)
        parents_a = ComparisonService._get_parent_map(db, version_a_id)
        parents_b = ComparisonService._get_parent_map(db, version_b_id)

        changes: list[CompareChangeItem] = []
        summary = CompareSummary()

        all_node_ids = set(nodes_a.keys()) | set(nodes_b.keys())
        for hn_id in all_node_ids:
            na = nodes_a.get(hn_id)
            nb = nodes_b.get(hn_id)
            if na and not nb:
                changes.append(CompareChangeItem(change_type="Removed", node=na.display_name, old_value=na.display_name, new_value=None, hierarchy_node_id=hn_id))
                summary.removed += 1
            elif nb and not na:
                changes.append(CompareChangeItem(change_type="Added", node=nb.display_name, old_value=None, new_value=nb.display_name, hierarchy_node_id=hn_id))
                summary.added += 1
            elif na and nb:
                if na.display_name != nb.display_name:
                    changes.append(CompareChangeItem(change_type="Renamed", node=nb.display_name, old_value=na.display_name, new_value=nb.display_name, hierarchy_node_id=hn_id))
                    summary.renamed += 1
                parent_a = parents_a.get(na.version_node_id)
                parent_b = parents_b.get(nb.version_node_id)
                if parent_a != parent_b:
                    old_name = ComparisonService._parent_name(db, parent_a) if parent_a else "Root"
                    new_name = ComparisonService._parent_name(db, parent_b) if parent_b else "Root"
                    changes.append(CompareChangeItem(change_type="Moved", node=nb.display_name, old_value=old_name, new_value=new_name, hierarchy_node_id=hn_id))
                    summary.moved += 1
                props_a = na.properties or {}
                props_b = nb.properties or {}
                for key in set(props_a.keys()) | set(props_b.keys()):
                    if props_a.get(key) != props_b.get(key):
                        changes.append(
                            CompareChangeItem(
                                change_type="Property",
                                node=nb.display_name,
                                old_value=str(props_a.get(key)),
                                new_value=str(props_b.get(key)),
                                hierarchy_node_id=hn_id,
                            )
                        )
                        summary.property_changed += 1

        return CompareResult(summary=summary, changes=changes)

    @staticmethod
    def _parent_name(db: Session, version_node_id: str) -> str:
        vn = db.query(HierarchyVersionNode).filter(HierarchyVersionNode.version_node_id == version_node_id).first()
        return vn.display_name if vn else "-"

    @staticmethod
    def _get_node_map(db: Session, version_id: str) -> dict[str, HierarchyVersionNode]:
        nodes = (
            db.query(HierarchyVersionNode)
            .filter(
                HierarchyVersionNode.hierarchy_version_id == version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
            .all()
        )
        return {n.hierarchy_node_id: n for n in nodes}

    @staticmethod
    def _get_parent_map(db: Session, version_id: str) -> dict[str, str | None]:
        edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == version_id).all()
        return {e.child_version_node_id: e.parent_version_node_id for e in edges}


class LineageService:
    @staticmethod
    def get_lineage(db: Session, hierarchy_id: str | None = None, version_id: str | None = None, node_id: str | None = None):
        from app.schemas.schemas import LineageEdge, LineageGraphResponse, LineageNode

        nodes: list[LineageNode] = []
        edges: list[LineageEdge] = []

        version_query = db.query(HierarchyVersion)
        if hierarchy_id:
            version_query = version_query.filter(HierarchyVersion.hierarchy_id == hierarchy_id)
        if version_id:
            version_query = version_query.filter(HierarchyVersion.hierarchy_version_id == version_id)
        versions = version_query.all()

        for v in versions:
            nodes.append(LineageNode(id=v.hierarchy_version_id, label=f"{v.version_no} ({v.status})", type="version"))
            if v.based_on_version_id:
                edges.append(
                    LineageEdge(
                        id=f"v-{v.based_on_version_id}-{v.hierarchy_version_id}",
                        source=v.based_on_version_id,
                        target=v.hierarchy_version_id,
                        label="derived from",
                    )
                )

        lineage_query = db.query(HierarchyCopyLineage).options(
            joinedload(HierarchyCopyLineage.target_version_node),
            joinedload(HierarchyCopyLineage.source_version_node),
        )
        if version_id:
            lineage_query = lineage_query.filter(HierarchyCopyLineage.source_hierarchy_version_id == version_id)
        lineages = lineage_query.limit(200).all()

        for lin in lineages:
            src_id = lin.source_version_node_id
            tgt_id = lin.target_version_node_id
            nodes.append(LineageNode(id=src_id, label=lin.source_version_node.display_name, type="node"))
            nodes.append(LineageNode(id=tgt_id, label=lin.target_version_node.display_name, type="node"))
            edges.append(
                LineageEdge(
                    id=lin.lineage_id,
                    source=src_id,
                    target=tgt_id,
                    label=lin.operation_type,
                )
            )

        unique_nodes = {n.id: n for n in nodes}
        return LineageGraphResponse(nodes=list(unique_nodes.values()), edges=edges)


class DashboardService:
    @staticmethod
    def get_stats(db: Session):
        from datetime import date, timedelta

        from app.models import ApprovalRequest, Hierarchy, HierarchyChange, HierarchyType
        from app.schemas.schemas import AuditChangeResponse, DashboardStats
        from app.utils.enums import ApprovalRequestStatus, VersionStatus

        total_types = db.query(HierarchyType).count()
        total_hierarchies = db.query(Hierarchy).count()
        active_versions = db.query(HierarchyVersion).filter(HierarchyVersion.status == VersionStatus.ACTIVE.value).count()
        draft_versions = db.query(HierarchyVersion).filter(HierarchyVersion.status == VersionStatus.DRAFT.value).count()
        pending = db.query(ApprovalRequest).filter(ApprovalRequest.status == ApprovalRequestStatus.OPEN.value).count()
        recent = db.query(HierarchyChange).order_by(HierarchyChange.changed_at.desc()).limit(10).all()
        approaching = (
            db.query(HierarchyVersion)
            .filter(
                HierarchyVersion.status == VersionStatus.APPROVED.value,
                HierarchyVersion.valid_from.isnot(None),
                HierarchyVersion.valid_from <= date.today() + timedelta(days=30),
            )
            .limit(10)
            .all()
        )
        return DashboardStats(
            total_hierarchy_types=total_types,
            total_hierarchies=total_hierarchies,
            active_versions=active_versions,
            draft_versions=draft_versions,
            pending_approvals=pending,
            recent_changes=[AuditChangeResponse.model_validate(c) for c in recent],
            versions_approaching_effective_date=approaching,
        )
