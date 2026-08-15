from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import NodeType, User
from app.schemas.schemas import MessageResponse, NodeTypeCreate, NodeTypeReorderItem, NodeTypeResponse, NodeTypeUpdate

router = APIRouter(prefix="/api/node-types", tags=["Node Types"])


@router.get("", response_model=list[NodeTypeResponse])
def list_node_types(
    db: Session = Depends(get_db),
    hierarchy_type_id: str | None = None,
    _: User = Depends(get_current_user),
):
    query = db.query(NodeType)
    if hierarchy_type_id:
        query = query.filter(NodeType.hierarchy_type_id == hierarchy_type_id)
    return query.order_by(NodeType.display_order).all()


@router.post("", response_model=NodeTypeResponse)
def create_node_type(payload: NodeTypeCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = NodeType(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{node_type_id}", response_model=NodeTypeResponse)
def get_node_type(node_type_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(NodeType).filter(NodeType.node_type_id == node_type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Node type not found")
    return item


@router.put("/{node_type_id}", response_model=NodeTypeResponse)
def update_node_type(node_type_id: str, payload: NodeTypeUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(NodeType).filter(NodeType.node_type_id == node_type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Node type not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@router.post("/reorder", response_model=list[NodeTypeResponse])
def reorder_node_types(items: list[NodeTypeReorderItem], db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    for item in items:
        nt = db.query(NodeType).filter(NodeType.node_type_id == item.node_type_id).first()
        if nt:
            nt.display_order = item.display_order
    db.commit()
    ids = [i.node_type_id for i in items]
    return db.query(NodeType).filter(NodeType.node_type_id.in_(ids)).order_by(NodeType.display_order).all()


@router.delete("/{node_type_id}", response_model=MessageResponse)
def delete_node_type(node_type_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(NodeType).filter(NodeType.node_type_id == node_type_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Node type not found")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Node type deleted")
