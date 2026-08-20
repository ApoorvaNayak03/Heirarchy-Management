from __future__ import annotations

import pytest

from app.models import NodePropertyDefinition
from app.services.rollup_service import RollupService
from app.utils.enums import AggregationFn, PropertyDataType


def _rollup(code: str, source: str, aggregation: str) -> NodePropertyDefinition:
    return NodePropertyDefinition(
        property_code=code,
        display_label=code,
        data_type=PropertyDataType.ROLLUP.value,
        rollup_source_property_code=source,
        rollup_aggregation=aggregation,
    )


def test_rollup_sum_coerces_string_numbers():
    rollup = _rollup("total_amount", "amount", AggregationFn.SUM.value)
    children = [{"amount": 100}, {"amount": 50}, {"amount": "25"}]
    assert RollupService.compute([rollup], children)["total_amount"] == 175


def test_rollup_avg():
    rollup = _rollup("total_amount", "amount", AggregationFn.AVG.value)
    children = [{"amount": 100}, {"amount": 50}, {"amount": 50}]
    assert RollupService.compute([rollup], children)["total_amount"] == pytest.approx(66.6667, rel=1e-3)


def test_rollup_count_non_empty():
    rollup = _rollup("headcount", "salary", AggregationFn.COUNT.value)
    children = [{"salary": 100}, {"salary": None}, {"other": 1}]
    assert RollupService.compute([rollup], children)["headcount"] == 1


def test_rollup_min_max():
    children = [{"amount": 10}, {"amount": 30}, {"amount": 5}]
    min_def = _rollup("min_amount", "amount", AggregationFn.MIN.value)
    max_def = _rollup("max_amount", "amount", AggregationFn.MAX.value)
    assert RollupService.compute([min_def], children)["min_amount"] == 5
    assert RollupService.compute([max_def], children)["max_amount"] == 30
