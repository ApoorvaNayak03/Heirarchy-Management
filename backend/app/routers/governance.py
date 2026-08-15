from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import HierarchyChange, User
from app.schemas.schemas import AuditChangeResponse, DashboardStats, LineageGraphResponse
from app.services.governance_service import DashboardService, LineageService

router = APIRouter(tags=["Governance"])


@router.get("/api/dashboard/stats", response_model=DashboardStats)
def dashboard_stats(db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    return DashboardService.get_stats(db)


@router.get("/api/audit", response_model=list[AuditChangeResponse])
def audit_trail(
    db: Session = Depends(get_db),
    user: str | None = None,
    action: str | None = None,
    entity_type: str | None = None,
    version_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    _: User = Depends(get_current_user),
):
    query = db.query(HierarchyChange)
    if user:
        query = query.filter(HierarchyChange.changed_by == user)
    if action:
        query = query.filter(HierarchyChange.action == action)
    if entity_type:
        query = query.filter(HierarchyChange.entity_type == entity_type)
    if version_id:
        query = query.filter(HierarchyChange.hierarchy_version_id == version_id)
    if date_from:
        query = query.filter(HierarchyChange.changed_at >= date_from)
    if date_to:
        query = query.filter(HierarchyChange.changed_at <= date_to)
    return query.order_by(HierarchyChange.changed_at.desc()).limit(500).all()


@router.get("/api/lineage", response_model=LineageGraphResponse)
def lineage(
    db: Session = Depends(get_db),
    hierarchy_id: str | None = None,
    version_id: str | None = None,
    node_id: str | None = None,
    _: User = Depends(get_current_user),
):
    return LineageService.get_lineage(db, hierarchy_id, version_id, node_id)
