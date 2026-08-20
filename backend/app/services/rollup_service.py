from __future__ import annotations

from typing import Any

from app.models import NodePropertyDefinition
from app.utils.enums import AggregationFn, PropertyDataType

AGGREGATIONS = {
    AggregationFn.SUM.value: sum,
    AggregationFn.COUNT.value: len,
    AggregationFn.AVG.value: lambda values: sum(values) / len(values) if values else 0,
    AggregationFn.MIN.value: min,
    AggregationFn.MAX.value: max,
}


def _numeric(value: Any) -> float:
    if isinstance(value, bool):
        return 0
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str) and value.strip():
        try:
            return float(value)
        except ValueError:
            return 0
    return 0


def _collect_values(children_properties: list[dict[str, Any]], source_code: str, aggregation: str) -> list[float]:
    if aggregation == AggregationFn.COUNT.value:
        return [1.0 for props in children_properties if props.get(source_code) not in (None, "")]
    return [_numeric(props.get(source_code)) for props in children_properties]


class RollupService:
    @staticmethod
    def compute(
        rollup_defs: list[NodePropertyDefinition],
        children_properties: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Aggregate each ROLLUP definition's source property across a node's direct children."""
        result: dict[str, Any] = {}
        for definition in rollup_defs:
            if definition.data_type != PropertyDataType.ROLLUP.value:
                continue
            aggregation = definition.rollup_aggregation or AggregationFn.SUM.value
            aggregate_fn = AGGREGATIONS.get(aggregation)
            if not aggregate_fn or not definition.rollup_source_property_code:
                continue
            values = _collect_values(children_properties, definition.rollup_source_property_code, aggregation)
            if aggregation == AggregationFn.COUNT.value:
                result[definition.property_code] = int(aggregate_fn(values))
            elif aggregation in {AggregationFn.AVG.value, AggregationFn.SUM.value}:
                result[definition.property_code] = round(aggregate_fn(values), 4) if values else 0
            elif values:
                result[definition.property_code] = aggregate_fn(values)
            else:
                result[definition.property_code] = 0
        return result
