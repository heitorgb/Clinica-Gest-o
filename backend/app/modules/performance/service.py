from datetime import UTC, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.performance.models import Commission, PerformanceGoal
from app.modules.performance.repository import (
    count_goals,
    get_commission_by_id,
    get_performance_goal_by_id,
    list_commissions,
    list_performance_goals,
    sum_commissions,
)
from app.modules.performance.schemas import (
    CommissionCreate,
    CommissionUpdate,
    PerformanceGoalCreate,
    PerformanceGoalUpdate,
    PerformanceSummary,
)
from app.modules.users.repository import get_user_by_id


def ensure_owner_exists(db: Session, owner_id: UUID | None) -> None:
    if owner_id is None:
        return

    owner = get_user_by_id(db, owner_id)
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Responsavel inexistente",
        )

    if not owner.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Responsavel inativo",
        )


def get_performance_goal_or_404(db: Session, goal_id: UUID) -> PerformanceGoal:
    goal = get_performance_goal_by_id(db, goal_id)
    if goal is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Meta nao encontrada",
        )
    return goal


def get_commission_or_404(db: Session, commission_id: UUID) -> Commission:
    commission = get_commission_by_id(db, commission_id)
    if commission is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Comissao nao encontrada",
        )
    return commission


def calculate_commission_amount(base_amount: Decimal, percentage: Decimal) -> Decimal:
    amount = base_amount * percentage / Decimal("100")
    return amount.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apply_commission_defaults(data: dict[str, object]) -> None:
    if data.get("amount") is None and "base_amount" in data and "percentage" in data:
        data["amount"] = calculate_commission_amount(
            data["base_amount"],
            data["percentage"],
        )

    if data.get("status") == "paid" and data.get("paid_at") is None:
        data["paid_at"] = datetime.now(UTC)


def create_performance_goal(db: Session, payload: PerformanceGoalCreate) -> PerformanceGoal:
    ensure_owner_exists(db, payload.owner_id)

    goal = PerformanceGoal(**payload.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def update_performance_goal(
    db: Session,
    goal: PerformanceGoal,
    payload: PerformanceGoalUpdate,
) -> PerformanceGoal:
    data = payload.model_dump(exclude_unset=True)

    if "owner_id" in data:
        ensure_owner_exists(db, data["owner_id"])

    for field, value in data.items():
        setattr(goal, field, value)

    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def create_commission(db: Session, payload: CommissionCreate) -> Commission:
    ensure_owner_exists(db, payload.owner_id)

    data = payload.model_dump()
    apply_commission_defaults(data)

    commission = Commission(**data)
    db.add(commission)
    db.commit()
    db.refresh(commission)
    return commission


def update_commission(
    db: Session,
    commission: Commission,
    payload: CommissionUpdate,
) -> Commission:
    data = payload.model_dump(exclude_unset=True)

    if "owner_id" in data:
        ensure_owner_exists(db, data["owner_id"])

    if data.get("amount") is None and (
        "base_amount" in data or "percentage" in data or "amount" in data
    ):
        data["base_amount"] = data.get("base_amount", commission.base_amount)
        data["percentage"] = data.get("percentage", commission.percentage)

    apply_commission_defaults(data)

    for field, value in data.items():
        setattr(commission, field, value)

    db.add(commission)
    db.commit()
    db.refresh(commission)
    return commission


def list_performance_goals_page(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    metric: str | None = None,
    owner_id: UUID | None = None,
) -> list[PerformanceGoal]:
    return list_performance_goals(
        db,
        skip=skip,
        limit=min(limit, 200),
        status=status,
        metric=metric,
        owner_id=owner_id,
    )


def list_commissions_page(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    owner_id: UUID | None = None,
) -> list[Commission]:
    return list_commissions(
        db,
        skip=skip,
        limit=min(limit, 200),
        status=status,
        owner_id=owner_id,
    )


def get_performance_summary(db: Session) -> PerformanceSummary:
    active_goals = list_performance_goals(db, limit=1000, status="active")
    average_progress = Decimal("0.00")

    if active_goals:
        average_progress = (
            sum(goal.progress_percent for goal in active_goals) / Decimal(len(active_goals))
        ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

    return PerformanceSummary(
        active_goals=count_goals(db, status="active"),
        completed_goals=count_goals(db, status="completed"),
        average_progress=average_progress,
        pending_commissions=sum_commissions(db, status="pending"),
        approved_commissions=sum_commissions(db, status="approved"),
        paid_commissions=sum_commissions(db, status="paid"),
    )
