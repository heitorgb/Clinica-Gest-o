from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.modules.finance.models import FinancialTransaction


def list_financial_transactions(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    transaction_type: str | None = None,
    status: str | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[FinancialTransaction]:
    statement = select(FinancialTransaction).order_by(
        FinancialTransaction.due_date,
        FinancialTransaction.created_at.desc(),
    )

    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                FinancialTransaction.description.ilike(pattern),
                FinancialTransaction.category.ilike(pattern),
                FinancialTransaction.counterparty.ilike(pattern),
            )
        )

    if transaction_type:
        statement = statement.where(FinancialTransaction.transaction_type == transaction_type)

    if status:
        statement = statement.where(FinancialTransaction.status == status)

    if due_from:
        statement = statement.where(FinancialTransaction.due_date >= due_from)

    if due_to:
        statement = statement.where(FinancialTransaction.due_date <= due_to)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def get_financial_transaction_by_id(
    db: Session,
    transaction_id: UUID,
) -> FinancialTransaction | None:
    statement = select(FinancialTransaction).where(FinancialTransaction.id == transaction_id)
    return db.execute(statement).scalar_one_or_none()


def sum_financial_transactions(
    db: Session,
    *,
    transaction_type: str | None = None,
    status: str | None = None,
    due_before: date | None = None,
) -> Decimal:
    statement = select(func.coalesce(func.sum(FinancialTransaction.amount), 0))

    if transaction_type:
        statement = statement.where(FinancialTransaction.transaction_type == transaction_type)

    if status:
        statement = statement.where(FinancialTransaction.status == status)

    if due_before:
        statement = statement.where(FinancialTransaction.due_date < due_before)

    value = db.execute(statement).scalar_one()
    return Decimal(value)
