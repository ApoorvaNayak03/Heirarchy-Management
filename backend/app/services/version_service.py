from __future__ import annotations

import uuid
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
    def list_versions(db: Session, hierarchy_id: str | None = None, status: str | None = None):
        query = db.query(HierarchyVersion)
        if hierarchy_id:
            query = query.filter(HierarchyVersion.hierarchy_id == hierarchy_id)
        if status:
            query = query.filter(HierarchyVersion.status == status)
        return query.order_by(HierarchyVersion.created_at.desc()).all()

    @staticmethod
    def get_version(db: Session, version_id: str) -> HierarchyVersion:
        version = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_version_id == version_id).first()
        if not version:
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
