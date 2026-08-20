from __future__ import annotations

from collections import defaultdict

from sqlalchemy.orm import Session

from app.models import NodePropertyDefinition, StructuralRule
from app.utils.enums import AggregationFn, EntityStatus, PropertyDataType


class RollupSyncService:
    """Auto-create ROLLUP property definitions on parent node types from child NUMBER / ROLLUP fields."""

    @staticmethod
    def sync_for_hierarchy_type(db: Session, hierarchy_type_id: str) -> dict:
        rules = (
            db.query(StructuralRule)
            .filter(
                StructuralRule.hierarchy_type_id == hierarchy_type_id,
                StructuralRule.status == EntityStatus.ACTIVE.value,
            )
            .all()
        )
        all_defs = (
            db.query(NodePropertyDefinition)
            .filter(NodePropertyDefinition.hierarchy_type_id == hierarchy_type_id)
            .all()
        )
        defs_by_type: dict[str, list[NodePropertyDefinition]] = defaultdict(list)
        for definition in all_defs:
            if definition.node_type_id:
                defs_by_type[definition.node_type_id].append(definition)

        created: list[dict] = []

        for rule in rules:
            parent_id = rule.parent_node_type_id
            child_id = rule.child_node_type_id
            for source_code, rollup_code, label, aggregation in RollupSyncService._sources_from_child_defs(
                defs_by_type.get(child_id, [])
            ):
                if RollupSyncService._parent_rollup_exists(all_defs, parent_id, rollup_code):
                    continue
                item = NodePropertyDefinition(
                    hierarchy_type_id=hierarchy_type_id,
                    node_type_id=parent_id,
                    property_code=rollup_code,
                    display_label=label,
                    data_type=PropertyDataType.ROLLUP.value,
                    rollup_source_property_code=source_code,
                    rollup_aggregation=aggregation,
                    required=False,
                    display_order=len(defs_by_type[parent_id]),
                )
                db.add(item)
                db.flush()
                all_defs.append(item)
                defs_by_type[parent_id].append(item)
                created.append(
                    {
                        "property_code": rollup_code,
                        "node_type_id": parent_id,
                        "rollup_source_property_code": source_code,
                        "rollup_aggregation": aggregation,
                    }
                )

        db.commit()
        return {"created_count": len(created), "created": created}

    @staticmethod
    def _sources_from_child_defs(child_defs: list[NodePropertyDefinition]) -> list[tuple[str, str, str, str]]:
        sources: list[tuple[str, str, str, str]] = []
        for definition in child_defs:
            if definition.data_type == PropertyDataType.NUMBER.value:
                rollup_code = f"total_{definition.property_code}"
                sources.append(
                    (
                        definition.property_code,
                        rollup_code,
                        f"Total {definition.display_label}",
                        AggregationFn.SUM.value,
                    )
                )
            elif definition.data_type == PropertyDataType.ROLLUP.value:
                sources.append(
                    (
                        definition.property_code,
                        definition.property_code,
                        definition.display_label,
                        definition.rollup_aggregation or AggregationFn.SUM.value,
                    )
                )
        return sources

    @staticmethod
    def _parent_rollup_exists(
        all_defs: list[NodePropertyDefinition],
        parent_type_id: str,
        rollup_code: str,
    ) -> bool:
        return any(
            d.node_type_id == parent_type_id
            and d.data_type == PropertyDataType.ROLLUP.value
            and d.property_code == rollup_code
            for d in all_defs
        )
