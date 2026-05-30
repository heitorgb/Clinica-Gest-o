from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.modules.performance.models import Commission, PerformanceGoal


def list_performance_goals(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    metric: str | None = None,
    owner_id: UUID | None = None,
) -> list[PerformanceGoal]:
    statement = (
        select(PerformanceGoal)
        .options(selectinload(PerformanceGoal.owner))
        .order_by(PerformanceGoal.period_end, PerformanceGoal.name)
    )

    if status:
        statement = statement.where(PerformanceGoal.status == status)

    if metric:
        statement = statement.where(PerformanceGoal.metric == metric)

    if owner_id:
        statement = statement.where(PerformanceGoal.owner_id == owner_id)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def get_performance_goal_by_id(db: Session, goal_id: UUID) -> PerformanceGoal | None:
    statement = (
        select(PerformanceGoal)
        .where(PerformanceGoal.id == goal_id)
        .options(selectinload(PerformanceGoal.owner))
    )
    return db.execute(statement).scalar_one_or_none()


def list_commissions(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    status: str | None = None,
    owner_id: UUID | None = None,
) -> list[Commission]:
    statement = (
        select(Commission)
        .options(selectinload(Commission.owner))
        .order_by(Commission.reference_date.desc(), Commission.created_at.desc())
    )

    if status:
        statement = statement.where(Commission.status == status)

    if owner_id:
        statement = statement.where(Commission.owner_id == owner_id)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def get_commission_by_id(db: Session, commission_id: UUID) -> Commission | None:
    statement = (
        select(Commission)
        .where(Commission.id == commission_id)
        .options(selectinload(Commission.owner))
    )
    return db.execute(statement).scalar_one_or_none()


def count_goals(db: Session, *, status: str | None = None) -> int:
    statement = select(func.count(PerformanceGoal.id))

    if status:
        statement = statement.where(PerformanceGoal.status == status)

    return db.execute(statement).scalar_one()


def sum_commissions(db: Session, *, status: str | None = None) -> Decimal:
    statement = select(func.coalesce(func.sum(Commission.amount), 0))

    if status:
        statement = statement.where(Commission.status == status)

    value = db.execute(statement).scalar_one()
    return Decimal(value)
