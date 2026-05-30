from datetime import date
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.finance.models import FinancialTransaction
from app.modules.finance.schemas import (
    FinancialSummary,
    FinancialTransactionCreate,
    FinancialTransactionPublic,
    FinancialTransactionStatus,
    FinancialTransactionType,
    FinancialTransactionUpdate,
)
from app.modules.finance.service import (
    create_financial_transaction,
    get_financial_summary,
    get_financial_transaction_or_404,
    list_financial_transactions_page,
    update_financial_transaction,
)
from app.modules.users.models import User

router = APIRouter(prefix="/finance")
require_finance_access = require_permission("finance:manage")


@router.get("/summary", response_model=FinancialSummary, summary="Resume o financeiro")
def get_financial_summary_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_finance_access)],
) -> FinancialSummary:
    return get_financial_summary(db)


@router.get(
    "/transactions",
    response_model=list[FinancialTransactionPublic],
    summary="Lista lancamentos financeiros",
)
def list_financial_transactions_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_finance_access)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    search: Annotated[str | None, Query(max_length=120)] = None,
    transaction_type: FinancialTransactionType | None = None,
    status: FinancialTransactionStatus | None = None,
    due_from: date | None = None,
    due_to: date | None = None,
) -> list[FinancialTransaction]:
    return list_financial_transactions_page(
        db,
        skip=skip,
        limit=limit,
        search=search,
        transaction_type=transaction_type,
        status=status,
        due_from=due_from,
        due_to=due_to,
    )


@router.post(
    "/transactions",
    response_model=FinancialTransactionPublic,
    status_code=201,
    summary="Cria lancamento financeiro",
)
def create_financial_transaction_endpoint(
    payload: FinancialTransactionCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_finance_access)],
) -> FinancialTransaction:
    return create_financial_transaction(db, payload)


@router.get(
    "/transactions/{transaction_id}",
    response_model=FinancialTransactionPublic,
    summary="Busca lancamento financeiro",
)
def get_financial_transaction_endpoint(
    transaction_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_finance_access)],
) -> FinancialTransaction:
    return get_financial_transaction_or_404(db, transaction_id)


@router.patch(
    "/transactions/{transaction_id}",
    response_model=FinancialTransactionPublic,
    summary="Atualiza lancamento financeiro",
)
def update_financial_transaction_endpoint(
    transaction_id: UUID,
    payload: FinancialTransactionUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_finance_access)],
) -> FinancialTransaction:
    transaction = get_financial_transaction_or_404(db, transaction_id)
    return update_financial_transaction(db, transaction, payload)
