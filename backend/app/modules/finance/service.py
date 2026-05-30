from datetime import UTC, date, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.finance.models import FinancialTransaction
from app.modules.finance.repository import (
    get_financial_transaction_by_id,
    list_financial_transactions,
    sum_financial_transactions,
)
from app.modules.finance.schemas import (
    FinancialSummary,
    FinancialTransactionCreate,
    FinancialTransactionUpdate,
)


def get_financial_transaction_or_404(
    db: Session,
    transaction_id: UUID,
) -> FinancialTransaction:
    transaction = get_financial_transaction_by_id(db, transaction_id)
    if transaction is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lancamento financeiro nao encontrado",
        )
    return transaction


def apply_payment_defaults(data: dict[str, object]) -> None:
    if data.get("status") == "paid" and data.get("paid_at") is None:
        data["paid_at"] = datetime.now(UTC)


def create_financial_transaction(
    db: Session,
    payload: FinancialTransactionCreate,
) -> FinancialTransaction:
    data = payload.model_dump()
    apply_payment_defaults(data)

    transaction = FinancialTransaction(**data)
    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def update_financial_transaction(
    db: Session,
    transaction: FinancialTransaction,
    payload: FinancialTransactionUpdate,
) -> FinancialTransaction:
    data = payload.model_dump(exclude_unset=True)
    apply_payment_defaults(data)

    for field, value in data.items():
        setattr(transaction, field, value)

    db.add(transaction)
    db.commit()
    db.refresh(transaction)
    return transaction


def list_financial_transactions_page(
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
    return list_financial_transactions(
        db,
        skip=skip,
        limit=min(limit, 200),
        search=search,
        transaction_type=transaction_type,
        status=status,
        due_from=due_from,
        due_to=due_to,
    )


def get_financial_summary(db: Session) -> FinancialSummary:
    today = date.today()
    receivable_open = sum_financial_transactions(
        db,
        transaction_type="receivable",
        status="open",
    )
    payable_open = sum_financial_transactions(
        db,
        transaction_type="payable",
        status="open",
    )
    overdue_receivable = sum_financial_transactions(
        db,
        transaction_type="receivable",
        status="open",
        due_before=today,
    )
    overdue_payable = sum_financial_transactions(
        db,
        transaction_type="payable",
        status="open",
        due_before=today,
    )
    paid_receivable = sum_financial_transactions(
        db,
        transaction_type="receivable",
        status="paid",
    )
    paid_payable = sum_financial_transactions(
        db,
        transaction_type="payable",
        status="paid",
    )

    return FinancialSummary(
        receivable_open=receivable_open,
        payable_open=payable_open,
        overdue_total=overdue_receivable + overdue_payable,
        paid_balance=paid_receivable - paid_payable,
        forecast_balance=receivable_open - payable_open,
    )
