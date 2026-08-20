from __future__ import annotations

import json
import re
from datetime import date, datetime
from typing import Any

from sqlalchemy.orm import Session

from app.models import (
    HierarchyEdge,
    HierarchyNode,
    HierarchyType,
    HierarchyVersion,
    HierarchyVersionNode,
    NodePropertyDefinition,
    NodeType,
    StructuralRule,
)
from app.schemas.schemas import ValidationErrorItem, ValidationResult
from app.utils.cycle import get_active_version_nodes, get_child_edges, would_create_cycle
from app.utils.enums import EntityStatus, NodeStatus, PropertyDataType, VersionStatus


class PropertyValidator:
    @staticmethod
    def validate_properties(
        db: Session,
        hierarchy_type_id: str,
        node_type_id: str,
        properties: dict[str, Any] | None,
        node_id: str | None = None,
    ) -> list[ValidationErrorItem]:
        errors: list[ValidationErrorItem] = []
        props = properties or {}
        definitions = (
            db.query(NodePropertyDefinition)
            .filter(
                NodePropertyDefinition.hierarchy_type_id == hierarchy_type_id,
                (NodePropertyDefinition.node_type_id == node_type_id)
                | (NodePropertyDefinition.node_type_id.is_(None)),
            )
            .order_by(NodePropertyDefinition.display_order)
            .all()
        )
        for definition in definitions:
            if definition.data_type == PropertyDataType.ROLLUP.value:
                continue
            value = props.get(definition.property_code)
            if definition.required and (value is None or value == ""):
                errors.append(
                    ValidationErrorItem(
                        type="PROPERTY",
                        node_id=node_id,
                        message=f"Required property '{definition.display_label}' is missing",
                    )
                )
                continue
            if value is None:
                continue
            dtype = definition.data_type
            if dtype == PropertyDataType.STRING.value and not isinstance(value, str):
                errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} must be a string"))
            elif dtype == PropertyDataType.NUMBER.value and not isinstance(value, (int, float)):
                errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} must be a number"))
            elif dtype == PropertyDataType.BOOLEAN.value and not isinstance(value, bool):
                errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} must be a boolean"))
            elif dtype == PropertyDataType.DATE.value:
                try:
                    if isinstance(value, str):
                        date.fromisoformat(value)
                except ValueError:
                    errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} must be a valid date"))
            elif dtype == PropertyDataType.ENUM.value:
                allowed = definition.allowed_values or []
                if value not in allowed:
                    errors.append(
                        ValidationErrorItem(
                            type="PROPERTY",
                            node_id=node_id,
                            message=f"{definition.property_code} must be one of {allowed}",
                        )
                    )
            elif dtype == PropertyDataType.REFERENCE.value and isinstance(value, str):
                exists = (
                    db.query(HierarchyNode)
                    .filter(HierarchyNode.stable_code == value)
                    .first()
                )
                if not exists:
                    errors.append(
                        ValidationErrorItem(
                            type="PROPERTY",
                            node_id=node_id,
                            message=f"Reference '{value}' for {definition.property_code} not found",
                        )
                    )
            if definition.validation_rule and value is not None:
                rule = definition.validation_rule.strip()
                if rule.startswith(">=") and isinstance(value, (int, float)):
                    threshold = float(rule[2:].strip())
                    if value < threshold:
                        errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} must be >= {threshold}"))
                elif rule.startswith("regex:"):
                    pattern = rule[6:]
                    if not re.match(pattern, str(value)):
                        errors.append(ValidationErrorItem(type="PROPERTY", node_id=node_id, message=f"{definition.property_code} failed validation rule"))
        return errors


class ValidationService:
    @staticmethod
    def validate_version(db: Session, version: HierarchyVersion) -> ValidationResult:
        errors: list[ValidationErrorItem] = []
        warnings: list[ValidationErrorItem] = []

        hierarchy = version.hierarchy
        hierarchy_type = hierarchy.hierarchy_type
        version_id = version.hierarchy_version_id

        if version.valid_from and version.valid_to and version.valid_from > version.valid_to:
            errors.append(ValidationErrorItem(type="VERSION", message="valid_from must be before or equal to valid_to"))

        active_nodes = get_active_version_nodes(db, version_id)
        edges = get_child_edges(db, version_id)

        parent_map: dict[str, list[str]] = {}
        child_to_parents: dict[str, list[str | None]] = {}
        for edge in edges:
            child_to_parents.setdefault(edge.child_version_node_id, []).append(edge.parent_version_node_id)
            if edge.parent_version_node_id:
                parent_map.setdefault(edge.parent_version_node_id, []).append(edge.child_version_node_id)

        node_by_id = {n.version_node_id: n for n in active_nodes}
        rules = (
            db.query(StructuralRule)
            .filter(
                StructuralRule.hierarchy_type_id == hierarchy_type.hierarchy_type_id,
                StructuralRule.status == EntityStatus.ACTIVE.value,
            )
            .all()
        )
        allowed_pairs = {(r.parent_node_type_id, r.child_node_type_id) for r in rules}

        for node in active_nodes:
            parents = child_to_parents.get(node.version_node_id, [])
            if not parents:
                continue
            if not hierarchy_type.allow_multiple_parents and len(parents) > 1:
                errors.append(
                    ValidationErrorItem(
                        type="STRUCTURAL",
                        node_id=node.version_node_id,
                        message=f"Node '{node.display_name}' has multiple parents but hierarchy type allows single parent only",
                    )
                )
            for parent_id in parents:
                if parent_id is None:
                    continue
                parent_node = node_by_id.get(parent_id)
                if not parent_node:
                    continue
                parent_type_id = parent_node.hierarchy_node.node_type_id
                child_type_id = node.hierarchy_node.node_type_id
                if (parent_type_id, child_type_id) not in allowed_pairs:
                    errors.append(
                        ValidationErrorItem(
                            type="STRUCTURAL",
                            node_id=node.version_node_id,
                            message=f"Invalid parent-child relationship for '{node.display_name}'",
                        )
                    )

        for node in active_nodes:
            parents = child_to_parents.get(node.version_node_id, [])
            if parents:
                continue
            node_type = node.hierarchy_node.node_type
            is_valid_root = any(r.parent_node_type_id is None for r in rules) or any(
                r.child_node_type_id == node_type.node_type_id for r in rules
            )
            has_parent_rules = any(r.child_node_type_id == node_type.node_type_id for r in rules)
            if has_parent_rules:
                parent_types_for_child = {r.parent_node_type_id for r in rules if r.child_node_type_id == node_type.node_type_id}
                if parent_types_for_child:
                    warnings.append(
                        ValidationErrorItem(
                            type="STRUCTURAL",
                            node_id=node.version_node_id,
                            message=f"Node '{node.display_name}' is a root node",
                        )
                    )

        connected = set()
        for edge in edges:
            connected.add(edge.child_version_node_id)
            if edge.parent_version_node_id:
                connected.add(edge.parent_version_node_id)
        for node in active_nodes:
            if node.version_node_id not in connected and len(active_nodes) > 1:
                parents = child_to_parents.get(node.version_node_id, [])
                if parents == []:
                    pass
                else:
                    errors.append(
                        ValidationErrorItem(
                            type="STRUCTURAL",
                            node_id=node.version_node_id,
                            message=f"Orphan node detected: '{node.display_name}'",
                        )
                    )

        for node in active_nodes:
            errors.extend(
                PropertyValidator.validate_properties(
                    db,
                    hierarchy_type.hierarchy_type_id,
                    node.hierarchy_node.node_type_id,
                    node.properties or {},
                    node.version_node_id,
                )
            )

        if version.status in {VersionStatus.APPROVED.value, VersionStatus.ACTIVE.value}:
            overlapping = (
                db.query(HierarchyVersion)
                .filter(
                    HierarchyVersion.hierarchy_id == version.hierarchy_id,
                    HierarchyVersion.hierarchy_version_id != version.hierarchy_version_id,
                    HierarchyVersion.status.in_([VersionStatus.APPROVED.value, VersionStatus.ACTIVE.value]),
                )
                .all()
            )
            for other in overlapping:
                if ValidationService._dates_overlap(version.valid_from, version.valid_to, other.valid_from, other.valid_to):
                    errors.append(
                        ValidationErrorItem(
                            type="VERSION",
                            message=f"Effective dates overlap with version {other.version_no}",
                        )
                    )

        return ValidationResult(valid=len(errors) == 0, errors=errors, warnings=warnings)

    @staticmethod
    def _dates_overlap(a_from: date | None, a_to: date | None, b_from: date | None, b_to: date | None) -> bool:
        start_a = a_from or date.min
        end_a = a_to or date.max
        start_b = b_from or date.min
        end_b = b_to or date.max
        return start_a <= end_b and start_b <= end_a

    @staticmethod
    def validate_parent_child(
        db: Session,
        hierarchy_type: HierarchyType,
        parent_version_node: HierarchyVersionNode | None,
        child_node_type_id: str,
        version_id: str,
        child_version_node_id: str | None = None,
        new_parent_id: str | None = None,
        replace_existing: bool = False,
    ) -> None:
        from fastapi import HTTPException

        rules = (
            db.query(StructuralRule)
            .filter(
                StructuralRule.hierarchy_type_id == hierarchy_type.hierarchy_type_id,
                StructuralRule.status == EntityStatus.ACTIVE.value,
                StructuralRule.child_node_type_id == child_node_type_id,
            )
            .all()
        )
        if parent_version_node is None:
            from app.services.node_service import NodeService

            root_eligible = NodeService.get_root_eligible_type_ids(db, hierarchy_type.hierarchy_type_id)
            if child_node_type_id not in root_eligible:
                raise HTTPException(status_code=400, detail="This node type cannot be used as a root node")
            return
        parent_type_id = parent_version_node.hierarchy_node.node_type_id
        allowed = any(r.parent_node_type_id == parent_type_id for r in rules)
        if not allowed:
            raise HTTPException(status_code=400, detail="The selected parent does not allow this node type")

        if child_version_node_id and not replace_existing:
            existing_edges = (
                db.query(HierarchyEdge)
                .filter(
                    HierarchyEdge.hierarchy_version_id == version_id,
                    HierarchyEdge.child_version_node_id == child_version_node_id,
                )
                .all()
            )
            if not hierarchy_type.allow_multiple_parents and existing_edges:
                if new_parent_id and all(e.parent_version_node_id != new_parent_id for e in existing_edges):
                    raise HTTPException(status_code=409, detail="Tree hierarchies cannot have multiple parents")
            if would_create_cycle(db, version_id, child_version_node_id, parent_version_node.version_node_id):
                raise HTTPException(status_code=409, detail="Move would create a cycle in the hierarchy")
