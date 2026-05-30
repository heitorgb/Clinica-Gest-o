from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from app.modules.finance.schemas import FinancialTransactionCreate, FinancialTransactionUpdate
from app.modules.finance.service import apply_payment_defaults


def test_financial_transaction_create_defaults_and_normalization() -> None:
    transaction = FinancialTransactionCreate(
        description="  Recebimento pacote estetico  ",
        transaction_type="receivable",
        category="  Receita  ",
        counterparty="  Mariana Lopes  ",
        amount=Decimal("3400.00"),
        due_date=date(2026, 5, 26),
    )

    assert transaction.description == "Recebimento pacote estetico"
    assert transaction.category == "Receita"
    assert transaction.counterparty == "Mariana Lopes"
    assert transaction.status == "open"
    assert transaction.amount == Decimal("3400.00")


def test_financial_transaction_rejects_zero_amount() -> None:
    with pytest.raises(ValidationError):
        FinancialTransactionCreate(
            description="Fornecedor materiais",
            transaction_type="payable",
            category="Despesa",
            amount=Decimal("0.00"),
            due_date=date(2026, 5, 28),
        )


def test_financial_transaction_update_allows_clearing_optional_fields() -> None:
    update = FinancialTransactionUpdate(counterparty=None, notes="  ")

    assert update.counterparty is None
    assert update.notes is None


def test_paid_status_sets_payment_date_when_missing() -> None:
    data: dict[str, object] = {"status": "paid", "paid_at": None}

    apply_payment_defaults(data)

    assert data["paid_at"] is not None
