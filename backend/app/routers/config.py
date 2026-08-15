from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import NodePropertyDefinition, NodeType, StructuralRule, User
from app.schemas.schemas import (
    MessageResponse,
    PropertyDefinitionCreate,
    PropertyDefinitionResponse,
    PropertyDefinitionUpdate,
    StructuralRuleCreate,
    StructuralRuleResponse,
    StructuralRuleUpdate,
)

properties_router = APIRouter(prefix="/api/property-definitions", tags=["Property Definitions"])


@properties_router.get("", response_model=list[PropertyDefinitionResponse])
def list_property_definitions(
    db: Session = Depends(get_db),
    hierarchy_type_id: str | None = None,
    node_type_id: str | None = None,
    _: User = Depends(get_current_user),
):
    query = db.query(NodePropertyDefinition)
    if hierarchy_type_id:
        query = query.filter(NodePropertyDefinition.hierarchy_type_id == hierarchy_type_id)
    if node_type_id:
        query = query.filter(NodePropertyDefinition.node_type_id == node_type_id)
    return query.order_by(NodePropertyDefinition.display_order).all()


@properties_router.post("", response_model=PropertyDefinitionResponse)
def create_property_definition(payload: PropertyDefinitionCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = NodePropertyDefinition(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@properties_router.put("/{definition_id}", response_model=PropertyDefinitionResponse)
def update_property_definition(definition_id: str, payload: PropertyDefinitionUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(NodePropertyDefinition).filter(NodePropertyDefinition.property_definition_id == definition_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Property definition not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return item


@properties_router.delete("/{definition_id}", response_model=MessageResponse)
def delete_property_definition(definition_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(NodePropertyDefinition).filter(NodePropertyDefinition.property_definition_id == definition_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Property definition not found")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Property definition deleted")


rules_router = APIRouter(prefix="/api/structural-rules", tags=["Structural Rules"])


@rules_router.get("", response_model=list[StructuralRuleResponse])
def list_structural_rules(db: Session = Depends(get_db), hierarchy_type_id: str | None = None, _: User = Depends(get_current_user)):
    query = db.query(StructuralRule)
    if hierarchy_type_id:
        query = query.filter(StructuralRule.hierarchy_type_id == hierarchy_type_id)
    rules = query.all()
    result = []
    for rule in rules:
        parent = db.query(NodeType).filter(NodeType.node_type_id == rule.parent_node_type_id).first()
        child = db.query(NodeType).filter(NodeType.node_type_id == rule.child_node_type_id).first()
        result.append(
            StructuralRuleResponse.model_validate(rule).model_copy(
                update={
                    "parent_node_type_name": parent.name if parent else None,
                    "child_node_type_name": child.name if child else None,
                }
            )
        )
    return result


@rules_router.post("", response_model=StructuralRuleResponse)
def create_structural_rule(payload: StructuralRuleCreate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    if payload.parent_node_type_id == payload.child_node_type_id:
        raise HTTPException(status_code=400, detail="Parent and child node types must differ")
    existing = (
        db.query(StructuralRule)
        .filter(
            StructuralRule.hierarchy_type_id == payload.hierarchy_type_id,
            StructuralRule.parent_node_type_id == payload.parent_node_type_id,
            StructuralRule.child_node_type_id == payload.child_node_type_id,
        )
        .first()
    )
    if existing:
        parent = db.query(NodeType).filter(NodeType.node_type_id == existing.parent_node_type_id).first()
        child = db.query(NodeType).filter(NodeType.node_type_id == existing.child_node_type_id).first()
        return StructuralRuleResponse.model_validate(existing).model_copy(
            update={
                "parent_node_type_name": parent.name if parent else None,
                "child_node_type_name": child.name if child else None,
            }
        )
    item = StructuralRule(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return StructuralRuleResponse.model_validate(item)


@rules_router.put("/{rule_id}", response_model=StructuralRuleResponse)
def update_structural_rule(rule_id: str, payload: StructuralRuleUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(StructuralRule).filter(StructuralRule.structural_rule_id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Structural rule not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    db.commit()
    db.refresh(item)
    return StructuralRuleResponse.model_validate(item)


@rules_router.delete("/{rule_id}", response_model=MessageResponse)
def delete_structural_rule(rule_id: str, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    item = db.query(StructuralRule).filter(StructuralRule.structural_rule_id == rule_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Structural rule not found")
    db.delete(item)
    db.commit()
    return MessageResponse(message="Structural rule deleted")
