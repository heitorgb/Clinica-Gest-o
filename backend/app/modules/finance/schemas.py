from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

FinancialTransactionType = Literal["receivable", "payable"]
FinancialTransactionStatus = Literal["open", "paid", "overdue", "canceled"]


class FinancialTransactionBase(BaseModel):
    description: str = Field(min_length=2, max_length=180)
    transaction_type: FinancialTransactionType
    category: str = Field(min_length=2, max_length=80)
    counterparty: str | None = Field(default=None, max_length=160)
    amount: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    due_date: date
    paid_at: datetime | None = None
    status: FinancialTransactionStatus = "open"
    payment_method: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "description",
        "category",
        "counterparty",
        "payment_method",
        "notes",
        mode="before",
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class FinancialTransactionCreate(FinancialTransactionBase):
    pass


class FinancialTransactionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=2, max_length=180)
    transaction_type: FinancialTransactionType | None = None
    category: str | None = Field(default=None, min_length=2, max_length=80)
    counterparty: str | None = Field(default=None, max_length=160)
    amount: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    due_date: date | None = None
    paid_at: datetime | None = None
    status: FinancialTransactionStatus | None = None
    payment_method: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "description",
        "category",
        "counterparty",
        "payment_method",
        "notes",
        mode="before",
    )
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class FinancialTransactionPublic(BaseModel):
    id: UUID
    description: str
    transaction_type: str
    category: str
    counterparty: str | None = None
    amount: Decimal
    due_date: date
    paid_at: datetime | None = None
    status: str
    payment_method: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class FinancialSummary(BaseModel):
    receivable_open: Decimal
    payable_open: Decimal
    overdue_total: Decimal
    paid_balance: Decimal
    forecast_balance: Decimal
