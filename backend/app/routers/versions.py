from __future__ import annotations

from typing import Optional

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.dependencies import get_current_user
from app.models import ApprovalRequest, User
from app.schemas.schemas import (
    ActivateVersionRequest,
    ApprovalActionRequest,
    ApprovalRequestResponse,
    ApprovalStepResponse,
    CompareResult,
    CopySubtreeRequest,
    MessageResponse,
    NodeCloneRequest,
    NodeCreate,
    NodeMoveRequest,
    NodeUpdate,
    SubmitApprovalRequest,
    TreeNodeResponse,
    ValidationResult,
    VersionCreate,
    VersionResponse,
    VersionUpdate,
)
from app.services.governance_service import ComparisonService
from app.services.node_service import NodeService
from app.services.version_service import ActivationService, ApprovalService, VersionService
from app.validators.validation_service import ValidationService

router = APIRouter(tags=["Versions"])


@router.get("/api/versions", response_model=list[VersionResponse])
def list_versions(hierarchy_id: str | None = None, status: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return VersionService.list_versions(db, hierarchy_id, status)


@router.get("/api/versions/{version_id}", response_model=VersionResponse)
def get_version(version_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return VersionService.get_version(db, version_id)


@router.post("/api/hierarchies/{hierarchy_id}/versions", response_model=VersionResponse)
def create_version(hierarchy_id: str, payload: VersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return VersionService.create_initial_version(db, hierarchy_id, payload, user)


@router.post("/api/versions/{version_id}/copy", response_model=VersionResponse)
def copy_version(version_id: str, payload: VersionCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return VersionService.create_from_version(db, version_id, payload, user)


@router.patch("/api/versions/{version_id}", response_model=VersionResponse)
def update_version(version_id: str, payload: VersionUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return VersionService.update_version(db, version_id, payload, user)


@router.post("/api/versions/{version_id}/cancel", response_model=VersionResponse)
def cancel_version(version_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return VersionService.cancel_version(db, version_id, user)


@router.post("/api/versions/{version_id}/return-to-draft", response_model=VersionResponse)
def return_to_draft(version_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return VersionService.return_to_draft(db, version_id, user)


@router.get("/api/hierarchies/{hierarchy_id}/versions/effective", response_model=Optional[VersionResponse])
def effective_version(hierarchy_id: str, business_date: date, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    version = VersionService.get_effective_version(db, hierarchy_id, business_date)
    if not version:
        raise HTTPException(status_code=404, detail="No effective version found for date")
    return version


@router.get("/api/versions/{version_id}/tree", response_model=list[TreeNodeResponse])
def get_tree(version_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return NodeService.build_tree(db, version_id)


@router.get("/api/versions/{version_id}/allowed-child-types")
def allowed_child_types(version_id: str, parent_version_node_id: str | None = None, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    types = NodeService.get_allowed_child_types(db, version_id, parent_version_node_id)
    return [{"node_type_id": t.node_type_id, "code": t.code, "name": t.name} for t in types]


@router.post("/api/versions/{version_id}/nodes")
def add_node(version_id: str, payload: NodeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vn = NodeService.add_node(db, version_id, payload, user)
    return {"version_node_id": vn.version_node_id, "display_name": vn.display_name}


@router.patch("/api/versions/{version_id}/nodes/{node_id}")
def update_node(version_id: str, node_id: str, payload: NodeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vn = NodeService.update_node(db, version_id, node_id, payload, user)
    return {"version_node_id": vn.version_node_id, "display_name": vn.display_name}


@router.delete("/api/versions/{version_id}/nodes/{node_id}", response_model=MessageResponse)
def delete_node(version_id: str, node_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    NodeService.delete_node(db, version_id, node_id, user)
    return MessageResponse(message="Node removed")


@router.post("/api/versions/{version_id}/nodes/{node_id}/move")
def move_node(version_id: str, node_id: str, payload: NodeMoveRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vn = NodeService.move_node(db, version_id, node_id, payload, user)
    return {"version_node_id": vn.version_node_id}


@router.post("/api/versions/{version_id}/nodes/{node_id}/clone")
def clone_node(version_id: str, node_id: str, payload: NodeCloneRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    vn = NodeService.clone_node(db, version_id, node_id, payload, user)
    return {"version_node_id": vn.version_node_id, "display_name": vn.display_name}


@router.post("/api/versions/{version_id}/copy-subtree")
def copy_subtree(version_id: str, payload: CopySubtreeRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return NodeService.copy_subtree(db, version_id, payload, user)


@router.post("/api/versions/{version_id}/validate", response_model=ValidationResult)
def validate_version(version_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    version = VersionService.get_version(db, version_id)
    return ValidationService.validate_version(db, version)


@router.post("/api/versions/{version_id}/submit")
def submit_version(version_id: str, payload: SubmitApprovalRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    request = ApprovalService.submit(db, version_id, payload, user)
    return {"approval_request_id": request.approval_request_id}


@router.post("/api/versions/{version_id}/activate", response_model=VersionResponse)
def activate_version(version_id: str, payload: ActivateVersionRequest = ActivateVersionRequest(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    return ActivationService.activate(db, version_id, payload, user)


@router.get("/api/versions/{version_id}/compare/{other_version_id}", response_model=CompareResult)
def compare_versions(version_id: str, other_version_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    try:
        return ComparisonService.compare(db, version_id, other_version_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/api/approval-requests", response_model=list[ApprovalRequestResponse])
def list_approval_requests(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    requests = db.query(ApprovalRequest).options(joinedload(ApprovalRequest.steps), joinedload(ApprovalRequest.hierarchy_version)).order_by(ApprovalRequest.submitted_at.desc()).all()
    result = []
    for req in requests:
        version = req.hierarchy_version
        hierarchy = version.hierarchy if version else None
        result.append(
            ApprovalRequestResponse(
                approval_request_id=req.approval_request_id,
                hierarchy_version_id=req.hierarchy_version_id,
                status=req.status,
                submitted_by=req.submitted_by,
                submitted_at=req.submitted_at,
                submission_comment=req.submission_comment,
                steps=[ApprovalStepResponse.model_validate(s) for s in req.steps],
                version_no=version.version_no if version else None,
                hierarchy_name=hierarchy.name if hierarchy else None,
            )
        )
    return result


@router.post("/api/approval-requests/{request_id}/steps/{step_id}/approve")
def approve_step(request_id: str, step_id: str, payload: ApprovalActionRequest = ApprovalActionRequest(), db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ApprovalService.approve_step(db, request_id, step_id, payload, user)
    return {"message": "Step approved"}


@router.post("/api/approval-requests/{request_id}/steps/{step_id}/reject")
def reject_step(request_id: str, step_id: str, payload: ApprovalActionRequest, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    ApprovalService.reject_step(db, request_id, step_id, payload, user)
    return {"message": "Step rejected"}
