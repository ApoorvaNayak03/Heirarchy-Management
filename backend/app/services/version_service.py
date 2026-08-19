from __future__ import annotations

import uuid
from collections import defaultdict
from datetime import date, datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.dependencies import serialize_value
from app.models import (
    ApprovalRequest,
    ApprovalStep,
    Hierarchy,
    HierarchyCopyLineage,
    HierarchyEdge,
    HierarchyNode,
    HierarchyVersion,
    HierarchyVersionNode,
    User,
)
from app.schemas.schemas import (
    ActivateVersionRequest,
    ApprovalActionRequest,
    ConflictItem,
    ConflictsResponse,
    MergeDraftRequest,
    ResolveConflictsRequest,
    SubmitApprovalRequest,
    VersionCreate,
    VersionUpdate,
)
from app.services.audit_service import AuditService
from app.services.governance_service import ComparisonService
from app.utils.enums import (
    ApprovalRequestStatus,
    ApprovalStepStatus,
    ChangeAction,
    ChangeEntityType,
    LineageOperationType,
    NodeStatus,
    VersionStatus,
)
from app.validators.validation_service import ValidationService


class VersionService:
    @staticmethod
    def list_versions(db: Session, user: User, hierarchy_id: str | None = None, status: str | None = None):
        query = db.query(HierarchyVersion)
        if hierarchy_id:
            query = query.filter(HierarchyVersion.hierarchy_id == hierarchy_id)
        if status:
            query = query.filter(HierarchyVersion.status == status)
        versions = query.order_by(HierarchyVersion.created_at.desc()).all()
        return [v for v in versions if VersionService.can_user_view_version(user, v)]

    @staticmethod
    def can_user_view_version(user: User, version: HierarchyVersion) -> bool:
        if version.status != VersionStatus.DRAFT.value:
            return True
        return user.username == version.created_by or user.username == "admin"

    @staticmethod
    def get_version(db: Session, version_id: str) -> HierarchyVersion:
        version = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        if not version:
            raise HTTPException(status_code=404, detail="Version not found")
        return version

    @staticmethod
    def get_version_for_user(db: Session, version_id: str, user: User) -> HierarchyVersion:
        version = VersionService.get_version(db, version_id)
        if not VersionService.can_user_view_version(user, version):
            raise HTTPException(status_code=404, detail="Version not found")
        return version

    @staticmethod
    def create_initial_version(db: Session, hierarchy_id: str, payload: VersionCreate, user: User) -> HierarchyVersion:
        hierarchy = db.query(Hierarchy).filter(Hierarchy.hierarchy_id == hierarchy_id).first()
        if not hierarchy:
            raise HTTPException(status_code=404, detail="Hierarchy not found")
        count = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == hierarchy_id).count()
        version = HierarchyVersion(
            hierarchy_version_id=str(uuid.uuid4()),
            hierarchy_id=hierarchy_id,
            version_no=payload.version_no or f"v{count + 1}",
            version_name=payload.version_name,
            description=payload.description,
            valid_from=payload.valid_from,
            valid_to=payload.valid_to,
            status=VersionStatus.DRAFT.value,
            created_by=user.username,
        )
        db.add(version)
        AuditService.log_change(
            db,
            hierarchy_id=hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=version.hierarchy_version_id,
            action=ChangeAction.CREATE,
            changed_by=user.username,
            field_name="status",
            new_value=VersionStatus.DRAFT.value,
        )
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def create_from_version(db: Session, source_version_id: str, payload: VersionCreate, user: User) -> HierarchyVersion:
        source = VersionService.get_version(db, source_version_id)
        count = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == source.hierarchy_id).count()
        target = HierarchyVersion(
            hierarchy_version_id=str(uuid.uuid4()),
            hierarchy_id=source.hierarchy_id,
            version_no=payload.version_no or f"v{count + 1}",
            version_name=payload.version_name or f"Copy of {source.version_no}",
            description=payload.description or source.description,
            valid_from=payload.valid_from,
            valid_to=payload.valid_to,
            status=VersionStatus.DRAFT.value,
            based_on_version_id=source.hierarchy_version_id,
            created_by=user.username,
        )
        db.add(target)
        db.flush()

        node_map: dict[str, str] = {}
        source_nodes = (
            db.query(HierarchyVersionNode)
            .filter(
                HierarchyVersionNode.hierarchy_version_id == source.hierarchy_version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
            .all()
        )
        for src_node in source_nodes:
            new_vn = HierarchyVersionNode(
                version_node_id=str(uuid.uuid4()),
                hierarchy_version_id=target.hierarchy_version_id,
                hierarchy_node_id=src_node.hierarchy_node_id,
                display_name=src_node.display_name,
                sibling_order=src_node.sibling_order,
                node_status=NodeStatus.ACTIVE.value,
                properties=src_node.properties.copy() if src_node.properties else {},
            )
            db.add(new_vn)
            db.flush()
            node_map[src_node.version_node_id] = new_vn.version_node_id
            lineage = HierarchyCopyLineage(
                lineage_id=str(uuid.uuid4()),
                target_version_node_id=new_vn.version_node_id,
                source_hierarchy_version_id=source.hierarchy_version_id,
                source_version_node_id=src_node.version_node_id,
                operation_type=LineageOperationType.COPY_SUBTREE.value,
                created_by=user.username,
            )
            db.add(lineage)

        source_edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == source.hierarchy_version_id).all()
        for edge in source_edges:
            if edge.child_version_node_id not in node_map:
                continue
            new_edge = HierarchyEdge(
                edge_id=str(uuid.uuid4()),
                hierarchy_version_id=target.hierarchy_version_id,
                child_version_node_id=node_map[edge.child_version_node_id],
                parent_version_node_id=node_map.get(edge.parent_version_node_id) if edge.parent_version_node_id else None,
                relationship_order=edge.relationship_order,
            )
            db.add(new_edge)

        AuditService.log_change(
            db,
            hierarchy_id=source.hierarchy_id,
            hierarchy_version_id=target.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=target.hierarchy_version_id,
            action=ChangeAction.COPY,
            changed_by=user.username,
            field_name="based_on_version_id",
            new_value=source.hierarchy_version_id,
        )
        db.commit()
        db.refresh(target)
        return target

    @staticmethod
    def create_from_node(db: Session, source_version_id: str, hierarchy_node_id: str, payload: VersionCreate, user: User) -> HierarchyVersion:
        source = VersionService.get_version(db, source_version_id)

        source_nodes = (
            db.query(HierarchyVersionNode)
            .filter(
                HierarchyVersionNode.hierarchy_version_id == source.hierarchy_version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
            .all()
        )
        source_lookup = {n.hierarchy_node_id: n for n in source_nodes}
        if hierarchy_node_id not in source_lookup:
            raise HTTPException(status_code=404, detail="Node not found in source version")

        source_edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == source.hierarchy_version_id).all()
        vn_by_id = {n.version_node_id: n for n in source_nodes}
        root_vn_id = source_lookup[hierarchy_node_id].version_node_id

        subtree_vn_ids: set[str] = set()

        def collect(vn_id: str):
            subtree_vn_ids.add(vn_id)
            for edge in source_edges:
                if edge.parent_version_node_id == vn_id and edge.child_version_node_id in vn_by_id:
                    collect(edge.child_version_node_id)

        collect(root_vn_id)

        count = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == source.hierarchy_id).count()
        target = HierarchyVersion(
            hierarchy_version_id=str(uuid.uuid4()),
            hierarchy_id=source.hierarchy_id,
            version_no=payload.version_no or f"v{count + 1}",
            version_name=payload.version_name or f"Draft of {source_lookup[hierarchy_node_id].display_name}",
            description=payload.description or source.description,
            valid_from=payload.valid_from,
            valid_to=payload.valid_to,
            status=VersionStatus.DRAFT.value,
            based_on_version_id=source.hierarchy_version_id,
            scope_root_hierarchy_node_id=hierarchy_node_id,
            created_by=user.username,
        )
        db.add(target)
        db.flush()

        node_map: dict[str, str] = {}
        for vn_id in subtree_vn_ids:
            src_node = vn_by_id[vn_id]
            new_vn = HierarchyVersionNode(
                version_node_id=str(uuid.uuid4()),
                hierarchy_version_id=target.hierarchy_version_id,
                hierarchy_node_id=src_node.hierarchy_node_id,
                display_name=src_node.display_name,
                sibling_order=src_node.sibling_order,
                node_status=NodeStatus.ACTIVE.value,
                properties=src_node.properties.copy() if src_node.properties else {},
            )
            db.add(new_vn)
            db.flush()
            node_map[vn_id] = new_vn.version_node_id
            lineage = HierarchyCopyLineage(
                lineage_id=str(uuid.uuid4()),
                target_version_node_id=new_vn.version_node_id,
                source_hierarchy_version_id=source.hierarchy_version_id,
                source_version_node_id=src_node.version_node_id,
                operation_type=LineageOperationType.COPY_SUBTREE.value,
                created_by=user.username,
            )
            db.add(lineage)

        for edge in source_edges:
            if edge.child_version_node_id not in node_map:
                continue
            if edge.child_version_node_id == root_vn_id:
                continue  # subtree root has no parent within the draft
            new_edge = HierarchyEdge(
                edge_id=str(uuid.uuid4()),
                hierarchy_version_id=target.hierarchy_version_id,
                child_version_node_id=node_map[edge.child_version_node_id],
                parent_version_node_id=node_map.get(edge.parent_version_node_id) if edge.parent_version_node_id else None,
                relationship_order=edge.relationship_order,
            )
            db.add(new_edge)

        AuditService.log_change(
            db,
            hierarchy_id=source.hierarchy_id,
            hierarchy_version_id=target.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=target.hierarchy_version_id,
            action=ChangeAction.COPY,
            changed_by=user.username,
            field_name="scope_root_hierarchy_node_id",
            new_value=hierarchy_node_id,
        )
        db.commit()
        db.refresh(target)
        return target

    @staticmethod
    def update_version(db: Session, version_id: str, payload: VersionUpdate, user: User) -> HierarchyVersion:
        version = VersionService.get_version(db, version_id)
        if version.status not in {VersionStatus.DRAFT.value, VersionStatus.REJECTED.value}:
            raise HTTPException(status_code=409, detail="Only draft or rejected versions can be updated")
        for field, value in payload.model_dump(exclude_unset=True).items():
            old = getattr(version, field)
            setattr(version, field, value)
            AuditService.log_change(
                db,
                hierarchy_id=version.hierarchy_id,
                hierarchy_version_id=version.hierarchy_version_id,
                entity_type=ChangeEntityType.VERSION,
                entity_id=version.hierarchy_version_id,
                action=ChangeAction.UPDATE,
                changed_by=user.username,
                field_name=field,
                old_value=serialize_value(old),
                new_value=serialize_value(value),
            )
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def cancel_version(db: Session, version_id: str, user: User) -> HierarchyVersion:
        version = VersionService.get_version(db, version_id)
        if version.status != VersionStatus.DRAFT.value:
            raise HTTPException(status_code=409, detail="Only draft versions can be cancelled")
        version.status = VersionStatus.CANCELLED.value
        version.cancelled_at = datetime.utcnow()
        version.cancelled_by = user.username
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=version.hierarchy_version_id,
            action=ChangeAction.CANCEL,
            changed_by=user.username,
        )
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def return_to_draft(db: Session, version_id: str, user: User) -> HierarchyVersion:
        version = VersionService.get_version(db, version_id)
        if version.status != VersionStatus.REJECTED.value:
            raise HTTPException(status_code=409, detail="Only rejected versions can return to draft")
        version.status = VersionStatus.DRAFT.value
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=version.hierarchy_version_id,
            action=ChangeAction.UPDATE,
            changed_by=user.username,
            field_name="status",
            old_value=VersionStatus.REJECTED.value,
            new_value=VersionStatus.DRAFT.value,
        )
        db.commit()
        db.refresh(version)
        return version

    @staticmethod
    def get_effective_version(db: Session, hierarchy_id: str, business_date: date) -> HierarchyVersion | None:
        versions = (
            db.query(HierarchyVersion)
            .filter(
                HierarchyVersion.hierarchy_id == hierarchy_id,
                HierarchyVersion.status == VersionStatus.ACTIVE.value,
            )
            .all()
        )
        for version in versions:
            start = version.valid_from or date.min
            end = version.valid_to or date.max
            if start <= business_date <= end:
                return version
        return None


class ApprovalService:
    @staticmethod
    def submit(db: Session, version_id: str, payload: SubmitApprovalRequest, user: User) -> ApprovalRequest:
        version = VersionService.get_version(db, version_id)
        if version.status != VersionStatus.DRAFT.value:
            raise HTTPException(status_code=409, detail="Only draft versions can be submitted")
        validation = ValidationService.validate_version(db, version)
        if not validation.valid:
            raise HTTPException(status_code=400, detail={"message": "Validation failed", "errors": [e.model_dump() for e in validation.errors]})
        if not payload.approval_steps:
            raise HTTPException(status_code=400, detail="At least one approval step is required")

        version.status = VersionStatus.PENDING_APPROVAL.value
        request = ApprovalRequest(
            approval_request_id=str(uuid.uuid4()),
            hierarchy_version_id=version_id,
            status=ApprovalRequestStatus.OPEN.value,
            submitted_by=user.username,
            submission_comment=payload.comment,
        )
        db.add(request)
        db.flush()
        for step in sorted(payload.approval_steps, key=lambda s: s.step_sequence):
            db.add(
                ApprovalStep(
                    approval_step_id=str(uuid.uuid4()),
                    approval_request_id=request.approval_request_id,
                    step_sequence=step.step_sequence,
                    approver_role_or_user=step.approver_role_or_user,
                )
            )
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version_id,
            entity_type=ChangeEntityType.APPROVAL,
            entity_id=request.approval_request_id,
            action=ChangeAction.SUBMIT,
            changed_by=user.username,
            new_value=payload.comment,
        )
        db.commit()
        db.refresh(request)
        return request

    @staticmethod
    def approve_step(db: Session, request_id: str, step_id: str, payload: ApprovalActionRequest, user: User):
        from app.dependencies import can_user_act_on_step

        request = db.query(ApprovalRequest).filter(ApprovalRequest.approval_request_id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Approval request not found")
        step = db.query(ApprovalStep).filter(ApprovalStep.approval_step_id == step_id).first()
        if not step or step.approval_request_id != request_id:
            raise HTTPException(status_code=404, detail="Approval step not found")
        if not can_user_act_on_step(user, step.approver_role_or_user):
            raise HTTPException(status_code=403, detail="You are not authorized to act on this step")
        pending = [s for s in request.steps if s.status == ApprovalStepStatus.PENDING.value]
        if not pending or pending[0].approval_step_id != step_id:
            raise HTTPException(status_code=409, detail="Steps must be approved sequentially")

        step.status = ApprovalStepStatus.APPROVED.value
        step.acted_by = user.username
        step.acted_at = datetime.utcnow()
        step.comment = payload.comment
        version = request.hierarchy_version
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.APPROVAL,
            entity_id=step.approval_step_id,
            action=ChangeAction.APPROVE,
            changed_by=user.username,
            new_value=payload.comment,
        )
        remaining = [s for s in request.steps if s.status == ApprovalStepStatus.PENDING.value]
        if not remaining:
            request.status = ApprovalRequestStatus.COMPLETED.value
            version.status = VersionStatus.APPROVED.value
        db.commit()
        return request

    @staticmethod
    def reject_step(db: Session, request_id: str, step_id: str, payload: ApprovalActionRequest, user: User):
        from app.dependencies import can_user_act_on_step

        if not payload.comment:
            raise HTTPException(status_code=400, detail="Rejection reason is required")
        request = db.query(ApprovalRequest).filter(ApprovalRequest.approval_request_id == request_id).first()
        if not request:
            raise HTTPException(status_code=404, detail="Approval request not found")
        step = db.query(ApprovalStep).filter(ApprovalStep.approval_step_id == step_id).first()
        if not step or step.approver_role_or_user and not can_user_act_on_step(user, step.approver_role_or_user):
            raise HTTPException(status_code=403, detail="You are not authorized to act on this step")
        step.status = ApprovalStepStatus.REJECTED.value
        step.acted_by = user.username
        step.acted_at = datetime.utcnow()
        step.comment = payload.comment
        request.status = ApprovalRequestStatus.COMPLETED.value
        version = request.hierarchy_version
        version.status = VersionStatus.REJECTED.value
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.APPROVAL,
            entity_id=step.approval_step_id,
            action=ChangeAction.REJECT,
            changed_by=user.username,
            new_value=payload.comment,
        )
        db.commit()
        return request


class ActivationService:
    @staticmethod
    def activate(db: Session, version_id: str, payload: ActivateVersionRequest, user: User) -> HierarchyVersion:
        version = VersionService.get_version(db, version_id)
        if version.status != VersionStatus.APPROVED.value:
            raise HTTPException(status_code=409, detail="Only approved versions can be activated")
        effective = payload.valid_from or date.today()
        version.valid_from = effective
        version.status = VersionStatus.ACTIVE.value

        current_active = (
            db.query(HierarchyVersion)
            .filter(
                HierarchyVersion.hierarchy_id == version.hierarchy_id,
                HierarchyVersion.status == VersionStatus.ACTIVE.value,
                HierarchyVersion.hierarchy_version_id != version_id,
            )
            .all()
        )
        for old in current_active:
            old.status = VersionStatus.RETIRED.value
            old.valid_to = effective
            AuditService.log_change(
                db,
                hierarchy_id=version.hierarchy_id,
                hierarchy_version_id=old.hierarchy_version_id,
                entity_type=ChangeEntityType.VERSION,
                entity_id=old.hierarchy_version_id,
                action=ChangeAction.RETIRE,
                changed_by=user.username,
            )
        AuditService.log_change(
            db,
            hierarchy_id=version.hierarchy_id,
            hierarchy_version_id=version.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=version.hierarchy_version_id,
            action=ChangeAction.ACTIVATE,
            changed_by=user.username,
            new_value=effective.isoformat(),
        )
        db.commit()
        db.refresh(version)
        return version


class ConflictService:
    """Detects and resolves 3-way conflicts between a proposed version, the version it
    was branched from, and the hierarchy's currently ACTIVE version."""

    @staticmethod
    def _active_version(db: Session, proposed: HierarchyVersion) -> HierarchyVersion | None:
        return (
            db.query(HierarchyVersion)
            .filter(
                HierarchyVersion.hierarchy_id == proposed.hierarchy_id,
                HierarchyVersion.status == VersionStatus.ACTIVE.value,
                HierarchyVersion.hierarchy_version_id != proposed.hierarchy_version_id,
            )
            .first()
        )

    @staticmethod
    def get_conflicts(db: Session, version_id: str) -> ConflictsResponse:
        proposed = VersionService.get_version(db, version_id)
        base_id = proposed.based_on_version_id
        active = ConflictService._active_version(db, proposed)

        if not base_id or not active:
            return ConflictsResponse(
                has_conflicts=False,
                active_version_id=active.hierarchy_version_id if active else None,
                base_version_id=base_id,
                conflicts=[],
            )

        base_nodes = ComparisonService.get_node_map(db, base_id)
        active_nodes = ComparisonService.get_node_map(db, active.hierarchy_version_id)
        proposed_nodes = ComparisonService.get_node_map(db, version_id)
        base_parents = ComparisonService.get_parent_map_by_hierarchy_id(db, base_id)
        active_parents = ComparisonService.get_parent_map_by_hierarchy_id(db, active.hierarchy_version_id)
        proposed_parents = ComparisonService.get_parent_map_by_hierarchy_id(db, version_id)

        conflicts: list[ConflictItem] = []
        common_ids = set(base_nodes) & set(active_nodes) & set(proposed_nodes)
        for hn_id in common_ids:
            base_node, active_node, proposed_node = base_nodes[hn_id], active_nodes[hn_id], proposed_nodes[hn_id]

            if (
                base_node.display_name != active_node.display_name
                and base_node.display_name != proposed_node.display_name
                and active_node.display_name != proposed_node.display_name
            ):
                conflicts.append(
                    ConflictItem(
                        hierarchy_node_id=hn_id,
                        node_name=proposed_node.display_name,
                        field="display_name",
                        base_value=base_node.display_name,
                        active_value=active_node.display_name,
                        proposed_value=proposed_node.display_name,
                    )
                )

            base_parent_id, active_parent_id, proposed_parent_id = (
                base_parents.get(hn_id),
                active_parents.get(hn_id),
                proposed_parents.get(hn_id),
            )
            if (
                base_parent_id != active_parent_id
                and base_parent_id != proposed_parent_id
                and active_parent_id != proposed_parent_id
            ):
                conflicts.append(
                    ConflictItem(
                        hierarchy_node_id=hn_id,
                        node_name=proposed_node.display_name,
                        field="parent",
                        base_value=ComparisonService.parent_name_by_hierarchy_id(db, base_parent_id) if base_parent_id else "Root",
                        active_value=ComparisonService.parent_name_by_hierarchy_id(db, active_parent_id) if active_parent_id else "Root",
                        proposed_value=ComparisonService.parent_name_by_hierarchy_id(db, proposed_parent_id) if proposed_parent_id else "Root",
                    )
                )

            base_props = base_node.properties or {}
            active_props = active_node.properties or {}
            proposed_props = proposed_node.properties or {}
            for key in set(base_props) | set(active_props) | set(proposed_props):
                base_value, active_value, proposed_value = base_props.get(key), active_props.get(key), proposed_props.get(key)
                if base_value != active_value and base_value != proposed_value and active_value != proposed_value:
                    conflicts.append(
                        ConflictItem(
                            hierarchy_node_id=hn_id,
                            node_name=proposed_node.display_name,
                            field=f"property:{key}",
                            base_value=str(base_value) if base_value is not None else None,
                            active_value=str(active_value) if active_value is not None else None,
                            proposed_value=str(proposed_value) if proposed_value is not None else None,
                        )
                    )

        return ConflictsResponse(
            has_conflicts=bool(conflicts),
            active_version_id=active.hierarchy_version_id,
            base_version_id=base_id,
            conflicts=conflicts,
        )

    @staticmethod
    def resolve_conflicts(db: Session, version_id: str, payload: ResolveConflictsRequest, user: User) -> HierarchyVersion:
        proposed = VersionService.get_version(db, version_id)
        if proposed.status not in {VersionStatus.DRAFT.value, VersionStatus.PENDING_APPROVAL.value}:
            raise HTTPException(status_code=409, detail="Version is not open for conflict resolution")

        active = ConflictService._active_version(db, proposed)
        if not active:
            raise HTTPException(status_code=409, detail="No active version to resolve conflicts against")

        proposed_nodes = {
            n.hierarchy_node_id: n
            for n in db.query(HierarchyVersionNode).filter(
                HierarchyVersionNode.hierarchy_version_id == version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
        }
        active_nodes = {
            n.hierarchy_node_id: n
            for n in db.query(HierarchyVersionNode).filter(
                HierarchyVersionNode.hierarchy_version_id == active.hierarchy_version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
        }
        active_parents = ComparisonService.get_parent_map_by_hierarchy_id(db, active.hierarchy_version_id)

        for resolution in payload.resolutions:
            if resolution.choice != "active":
                continue
            target_node = proposed_nodes.get(resolution.hierarchy_node_id)
            source_node = active_nodes.get(resolution.hierarchy_node_id)
            if not target_node or not source_node:
                continue

            if resolution.field == "display_name":
                old_value = target_node.display_name
                target_node.display_name = source_node.display_name
                AuditService.log_change(
                    db,
                    hierarchy_id=proposed.hierarchy_id,
                    hierarchy_version_id=version_id,
                    entity_type=ChangeEntityType.VERSION_NODE,
                    entity_id=target_node.version_node_id,
                    action=ChangeAction.UPDATE,
                    changed_by=user.username,
                    field_name="conflict_resolution:display_name",
                    old_value=old_value,
                    new_value=target_node.display_name,
                )

            elif resolution.field == "parent":
                new_parent_hn_id = active_parents.get(resolution.hierarchy_node_id)
                new_parent_version_node_id = (
                    proposed_nodes[new_parent_hn_id].version_node_id
                    if new_parent_hn_id and new_parent_hn_id in proposed_nodes
                    else None
                )
                edge = (
                    db.query(HierarchyEdge)
                    .filter(
                        HierarchyEdge.hierarchy_version_id == version_id,
                        HierarchyEdge.child_version_node_id == target_node.version_node_id,
                    )
                    .first()
                )
                if edge:
                    old_parent = edge.parent_version_node_id
                    edge.parent_version_node_id = new_parent_version_node_id
                    AuditService.log_change(
                        db,
                        hierarchy_id=proposed.hierarchy_id,
                        hierarchy_version_id=version_id,
                        entity_type=ChangeEntityType.EDGE,
                        entity_id=edge.edge_id,
                        action=ChangeAction.UPDATE,
                        changed_by=user.username,
                        field_name="conflict_resolution:parent",
                        old_value=old_parent,
                        new_value=new_parent_version_node_id,
                    )

            elif resolution.field.startswith("property:"):
                key = resolution.field.split(":", 1)[1]
                props = dict(target_node.properties or {})
                old_value = props.get(key)
                new_value = (source_node.properties or {}).get(key)
                props[key] = new_value
                target_node.properties = props
                AuditService.log_change(
                    db,
                    hierarchy_id=proposed.hierarchy_id,
                    hierarchy_version_id=version_id,
                    entity_type=ChangeEntityType.PROPERTY,
                    entity_id=target_node.version_node_id,
                    action=ChangeAction.UPDATE,
                    changed_by=user.username,
                    field_name=f"conflict_resolution:{resolution.field}",
                    old_value=str(old_value) if old_value is not None else None,
                    new_value=str(new_value) if new_value is not None else None,
                )

        db.commit()
        db.refresh(proposed)
        return proposed

    @staticmethod
    def merge_into_active(db: Session, version_id: str, payload: MergeDraftRequest, user: User) -> HierarchyVersion:
        """Merge a node-scoped draft's subtree back into the hierarchy's active version.

        Non-conflicting fields are auto-applied onto `active`. Conflicting fields (present
        in `payload.resolutions`) are applied per the caller's choice: "draft" copies the
        draft's value onto `active`, "active" leaves `active` untouched.
        """
        draft = VersionService.get_version(db, version_id)
        if not draft.scope_root_hierarchy_node_id:
            raise HTTPException(status_code=409, detail="Only node-scoped drafts can be merged")
        if draft.status != VersionStatus.APPROVED.value:
            raise HTTPException(status_code=409, detail="Only approved drafts can be merged")

        active = ConflictService._active_version(db, draft)
        if not active:
            raise HTTPException(status_code=409, detail="No active version to merge into")

        conflicts = ConflictService.get_conflicts(db, version_id)
        resolutions_by_key = {(r.hierarchy_node_id, r.field): r.choice for r in payload.resolutions}
        unresolved = [c for c in conflicts.conflicts if (c.hierarchy_node_id, c.field) not in resolutions_by_key]
        if unresolved:
            raise HTTPException(
                status_code=409,
                detail={"message": "Unresolved conflicts", "conflicts": [c.model_dump() for c in unresolved]},
            )

        draft_nodes = {
            n.hierarchy_node_id: n
            for n in db.query(HierarchyVersionNode).filter(HierarchyVersionNode.hierarchy_version_id == version_id)
        }
        active_nodes = {
            n.hierarchy_node_id: n
            for n in db.query(HierarchyVersionNode).filter(
                HierarchyVersionNode.hierarchy_version_id == active.hierarchy_version_id,
                HierarchyVersionNode.node_status == NodeStatus.ACTIVE.value,
            )
        }
        draft_parents = ComparisonService.get_parent_map_by_hierarchy_id(db, version_id)
        active_edges = db.query(HierarchyEdge).filter(HierarchyEdge.hierarchy_version_id == active.hierarchy_version_id).all()
        active_edge_by_child = {e.child_version_node_id: e for e in active_edges}

        conflicted_fields: dict[str, set[str]] = defaultdict(set)
        for c in conflicts.conflicts:
            conflicted_fields[c.hierarchy_node_id].add(c.field)

        def field_choice(hn_id: str, field: str) -> str:
            return resolutions_by_key.get((hn_id, field), "draft")

        for hn_id, draft_node in draft_nodes.items():
            active_node = active_nodes.get(hn_id)

            if draft_node.node_status == NodeStatus.REMOVED.value:
                if active_node and active_node.node_status != NodeStatus.REMOVED.value:
                    active_node.node_status = NodeStatus.REMOVED.value
                    AuditService.log_change(
                        db,
                        hierarchy_id=active.hierarchy_id,
                        hierarchy_version_id=active.hierarchy_version_id,
                        entity_type=ChangeEntityType.VERSION_NODE,
                        entity_id=active_node.version_node_id,
                        action=ChangeAction.DELETE,
                        changed_by=user.username,
                        field_name="merge:removed",
                    )
                continue

            if not active_node:
                if field_choice(hn_id, "display_name") == "active":
                    continue  # conflict resolved to discard the draft's addition
                if hn_id == draft.scope_root_hierarchy_node_id:
                    # The scope root's parent lives outside the draft's subtree and was
                    # never recorded — this shouldn't normally happen (the root already
                    # exists in active), but guard against inventing a root-level node.
                    continue
                new_parent_hn_id = draft_parents.get(hn_id)
                new_parent_vn_id = active_nodes[new_parent_hn_id].version_node_id if new_parent_hn_id in active_nodes else None
                new_active_node = HierarchyVersionNode(
                    version_node_id=str(uuid.uuid4()),
                    hierarchy_version_id=active.hierarchy_version_id,
                    hierarchy_node_id=hn_id,
                    display_name=draft_node.display_name,
                    sibling_order=draft_node.sibling_order,
                    node_status=NodeStatus.ACTIVE.value,
                    properties=draft_node.properties.copy() if draft_node.properties else {},
                )
                db.add(new_active_node)
                db.flush()
                active_nodes[hn_id] = new_active_node
                db.add(
                    HierarchyEdge(
                        edge_id=str(uuid.uuid4()),
                        hierarchy_version_id=active.hierarchy_version_id,
                        child_version_node_id=new_active_node.version_node_id,
                        parent_version_node_id=new_parent_vn_id,
                    )
                )
                AuditService.log_change(
                    db,
                    hierarchy_id=active.hierarchy_id,
                    hierarchy_version_id=active.hierarchy_version_id,
                    entity_type=ChangeEntityType.VERSION_NODE,
                    entity_id=new_active_node.version_node_id,
                    action=ChangeAction.CREATE,
                    changed_by=user.username,
                    field_name="merge:added",
                    new_value=draft_node.display_name,
                )
                continue

            if field_choice(hn_id, "display_name") == "draft" and active_node.display_name != draft_node.display_name:
                old_value = active_node.display_name
                active_node.display_name = draft_node.display_name
                AuditService.log_change(
                    db,
                    hierarchy_id=active.hierarchy_id,
                    hierarchy_version_id=active.hierarchy_version_id,
                    entity_type=ChangeEntityType.VERSION_NODE,
                    entity_id=active_node.version_node_id,
                    action=ChangeAction.UPDATE,
                    changed_by=user.username,
                    field_name="merge:display_name",
                    old_value=old_value,
                    new_value=active_node.display_name,
                )

            if hn_id != draft.scope_root_hierarchy_node_id and field_choice(hn_id, "parent") == "draft":
                # The scope root's parent lives outside the draft's subtree, so the draft
                # never recorded it — only descendants within the subtree can have their
                # parent field merged.
                new_parent_hn_id = draft_parents.get(hn_id)
                new_parent_vn_id = active_nodes[new_parent_hn_id].version_node_id if new_parent_hn_id in active_nodes else None
                edge = active_edge_by_child.get(active_node.version_node_id)
                if edge and edge.parent_version_node_id != new_parent_vn_id:
                    old_parent = edge.parent_version_node_id
                    edge.parent_version_node_id = new_parent_vn_id
                    AuditService.log_change(
                        db,
                        hierarchy_id=active.hierarchy_id,
                        hierarchy_version_id=active.hierarchy_version_id,
                        entity_type=ChangeEntityType.EDGE,
                        entity_id=edge.edge_id,
                        action=ChangeAction.MOVE,
                        changed_by=user.username,
                        field_name="merge:parent",
                        old_value=old_parent,
                        new_value=new_parent_vn_id,
                    )

            draft_props = draft_node.properties or {}
            active_props = active_node.properties or {}
            merged_props = dict(active_props)
            changed_props = False
            for key in set(draft_props) | set(active_props):
                field_name = f"property:{key}"
                if field_choice(hn_id, field_name) != "draft":
                    continue
                if draft_props.get(key) != active_props.get(key):
                    merged_props[key] = draft_props.get(key)
                    changed_props = True
            if changed_props:
                old_props = dict(active_node.properties or {})
                active_node.properties = merged_props
                AuditService.log_change(
                    db,
                    hierarchy_id=active.hierarchy_id,
                    hierarchy_version_id=active.hierarchy_version_id,
                    entity_type=ChangeEntityType.PROPERTY,
                    entity_id=active_node.version_node_id,
                    action=ChangeAction.UPDATE,
                    changed_by=user.username,
                    field_name="merge:properties",
                    old_value=str(old_props),
                    new_value=str(merged_props),
                )

        draft.merged_at = datetime.utcnow()
        AuditService.log_change(
            db,
            hierarchy_id=active.hierarchy_id,
            hierarchy_version_id=active.hierarchy_version_id,
            entity_type=ChangeEntityType.VERSION,
            entity_id=active.hierarchy_version_id,
            action=ChangeAction.MERGE,
            changed_by=user.username,
            field_name="merged_from_version_id",
            new_value=version_id,
        )
        db.commit()
        db.refresh(active)
        return active
