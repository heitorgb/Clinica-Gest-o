from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.performance.models import PerformanceGoal
from app.modules.performance.schemas import CommissionCreate, PerformanceGoalCreate
from app.modules.performance.service import apply_commission_defaults, calculate_commission_amount


def test_performance_goal_defaults_and_progress() -> None:
    payload = PerformanceGoalCreate(
        name="  Receita comercial  ",
        metric="revenue",
        target_value=Decimal("100000.00"),
        current_value=Decimal("25000.00"),
        period_start=date(2026, 5, 1),
        period_end=date(2026, 5, 31),
    )
    goal = PerformanceGoal(
        name=payload.name,
        metric=payload.metric,
        target_value=payload.target_value,
        current_value=payload.current_value,
        period_start=payload.period_start,
        period_end=payload.period_end,
    )

    assert payload.name == "Receita comercial"
    assert payload.status == "active"
    assert goal.progress_percent == Decimal("25.00")


def test_performance_goal_rejects_invalid_metric() -> None:
    with pytest.raises(ValidationError):
        PerformanceGoalCreate(
            name="Receita comercial",
            metric="invalid",
            target_value=Decimal("100000.00"),
            period_start=date(2026, 5, 1),
            period_end=date(2026, 5, 31),
        )


def test_commission_amount_is_calculated_from_percentage() -> None:
    assert calculate_commission_amount(Decimal("10000.00"), Decimal("3.50")) == Decimal("350.00")


def test_commission_create_defaults_and_normalization() -> None:
    commission = CommissionCreate(
        description="  Comissao pacote estetico  ",
        base_amount=Decimal("10000.00"),
        percentage=Decimal("3.00"),
        reference_date=date(2026, 5, 26),
    )
    data = commission.model_dump()

    apply_commission_defaults(data)

    assert commission.description == "Comissao pacote estetico"
    assert commission.status == "pending"
    assert data["amount"] == Decimal("300.00")
