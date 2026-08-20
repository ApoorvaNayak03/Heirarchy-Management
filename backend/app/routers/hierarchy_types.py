from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, serialize_value
from app.models import Hierarchy, HierarchyType, User
from app.schemas.schemas import HierarchyCreate, HierarchyResponse, HierarchyTypeCreate, HierarchyTypeResponse, HierarchyTypeUpdate, HierarchyUpdate, MessageResponse, SyncRollupsResponse
from app.services.rollup_sync_service import RollupSyncService
from app.services.audit_service import AuditService
from app.utils.enums import ChangeAction, ChangeEntityType

router = APIRouter(tags=["Hierarchy Types"])


@router.get("/api/hierarchy-types", response_model=list[HierarchyTypeResponse])
def list_hierarchy_types(
    db: Session = Depends(get_db),
    status: str | None = None,
    search: str | None = None,
    _: User = Depends(get_current_user),
):
    query = db.query(HierarchyType)
    if status:
        query = query.filter(HierarchyType.status == status)
    if search:
        like = f"%{search}%"
        query = query.filter((HierarchyType.name.ilike(like)) | (HierarchyType.code.ilike(like)))
    return query.order_by(HierarchyType.name).all()


@router.post("/api/hierarchy-types", response_model=HierarchyTypeResponse)
def create_hierarchy_type(payload: HierarchyTypeCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    if db.query(HierarchyType).filter(HierarchyType.code == payload.code).first():
        raise HTTPException(status_code=409, detail="Hierarchy type code already exists")
    item = HierarchyType(**payload.model_dump(), created_by=user.username)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/api/hierarchy-types/{type_id}", response_model=HierarchyTypeResponse)
def get_hierarchy_type(type_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(HierarchyType).filter(HierarchyType.hierarchy_type_id == type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy type not found")
    return item


@router.put("/api/hierarchy-types/{type_id}", response_model=HierarchyTypeResponse)
def update_hierarchy_type(type_id: str, payload: HierarchyTypeUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(HierarchyType).filter(HierarchyType.hierarchy_type_id == type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy type not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/api/hierarchy-types/{type_id}", response_model=MessageResponse)
def delete_hierarchy_type(type_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(HierarchyType).filter(HierarchyType.hierarchy_type_id == type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy type not found")
    if db.query(Hierarchy).filter(Hierarchy.hierarchy_type_id == type_id).count():
        raise HTTPException(status_code=409, detail="Cannot delete hierarchy type with dependent hierarchies")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Hierarchy type deleted")


@router.post("/api/hierarchy-types/{type_id}/sync-rollups", response_model=SyncRollupsResponse)
def sync_hierarchy_type_rollups(type_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(HierarchyType).filter(HierarchyType.hierarchy_type_id == type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy type not found")
    return RollupSyncService.sync_for_hierarchy_type(db, type_id)


hierarchies_router = APIRouter(tags=["Hierarchies"])


@hierarchies_router.get("/api/hierarchies", response_model=list[HierarchyResponse])
def list_hierarchies(db: Session = Depends(get_db), hierarchy_type_id: str | None = None, _: User = Depends(get_current_user)):
    query = db.query(Hierarchy)
    if hierarchy_type_id:
        query = query.filter(Hierarchy.hierarchy_type_id == hierarchy_type_id)
    return query.order_by(Hierarchy.name).all()


@hierarchies_router.post("/api/hierarchies", response_model=HierarchyResponse)
def create_hierarchy(payload: HierarchyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = Hierarchy(**payload.model_dump())
    db.add(item)
    db.flush()
    AuditService.log_change(
        db,
        hierarchy_id=item.hierarchy_id,
        hierarchy_version_id=None,
        entity_type=ChangeEntityType.HIERARCHY,
        entity_id=item.hierarchy_id,
        action=ChangeAction.CREATE,
        changed_by=user.username,
        new_value=item.name,
    )
    db.commit()
    db.refresh(item)
    return item


@hierarchies_router.get("/api/hierarchies/{hierarchy_id}", response_model=HierarchyResponse)
def get_hierarchy(hierarchy_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(Hierarchy).filter(Hierarchy.hierarchy_id == hierarchy_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    return item


@hierarchies_router.get("/api/hierarchies/{hierarchy_id}/detail")
def get_hierarchy_detail(hierarchy_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    from app.models import HierarchyVersion, NodeType, StructuralRule
    from app.utils.enums import VersionStatus

    hierarchy = db.query(Hierarchy).filter(Hierarchy.hierarchy_id == hierarchy_id).first()
    if not hierarchy:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    active = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == hierarchy_id, HierarchyVersion.status == VersionStatus.ACTIVE.value).first()
    draft = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == hierarchy_id, HierarchyVersion.status == VersionStatus.DRAFT.value).order_by(HierarchyVersion.created_at.desc()).first()
    versions = db.query(HierarchyVersion).filter(HierarchyVersion.hierarchy_id == hierarchy_id).order_by(HierarchyVersion.created_at.desc()).all()
    node_types = db.query(NodeType).filter(NodeType.hierarchy_type_id == hierarchy.hierarchy_type_id).order_by(NodeType.display_order).all()
    rules = db.query(StructuralRule).filter(StructuralRule.hierarchy_type_id == hierarchy.hierarchy_type_id).all()
    from app.models import HierarchyChange

    changes = db.query(HierarchyChange).filter(HierarchyChange.hierarchy_id == hierarchy_id).order_by(HierarchyChange.changed_at.desc()).limit(10).all()
    return {
        "hierarchy": HierarchyResponse.model_validate(hierarchy),
        "active_version": active,
        "latest_draft": draft,
        "versions": versions,
        "node_types": node_types,
        "structural_rules": rules,
        "recent_changes": changes,
    }


@hierarchies_router.put("/api/hierarchies/{hierarchy_id}", response_model=HierarchyResponse)
def update_hierarchy(hierarchy_id: str, payload: HierarchyUpdate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    item = db.query(Hierarchy).filter(Hierarchy.hierarchy_id == hierarchy_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        old = getattr(item, field)
        setattr(item, field, value)
        AuditService.log_change(
            db,
            hierarchy_id=hierarchy_id,
            hierarchy_version_id=None,
            entity_type=ChangeEntityType.HIERARCHY,
            entity_id=hierarchy_id,
            action=ChangeAction.UPDATE,
            changed_by=user.username,
            field_name=field,
            old_value=serialize_value(old),
            new_value=serialize_value(value),
        )
    db.commit()
    db.refresh(item)
    return item


@hierarchies_router.delete("/api/hierarchies/{hierarchy_id}", response_model=MessageResponse)
def delete_hierarchy(hierarchy_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(Hierarchy).filter(Hierarchy.hierarchy_id == hierarchy_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Hierarchy not found")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Hierarchy deleted")
