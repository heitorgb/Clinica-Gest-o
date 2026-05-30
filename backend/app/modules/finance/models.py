from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Date, DateTime, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

FINANCIAL_TRANSACTION_TYPES = ("receivable", "payable")
FINANCIAL_TRANSACTION_STATUSES = ("open", "paid", "overdue", "canceled")


class FinancialTransaction(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "financial_transactions"
    __table_args__ = (
        CheckConstraint(
            f"transaction_type in {FINANCIAL_TRANSACTION_TYPES}",
            name="financial_transaction_type_valid",
        ),
        CheckConstraint(
            f"status in {FINANCIAL_TRANSACTION_STATUSES}",
            name="financial_transaction_status_valid",
        ),
    )

    description: Mapped[str] = mapped_column(String(180), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(20), nullable=False)
    category: Mapped[str] = mapped_column(String(80), nullable=False)
    counterparty: Mapped[str | None] = mapped_column(String(160))
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0",
    )
    due_date: Mapped[date] = mapped_column(Date, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        server_default="open",
    )
    payment_method: Mapped[str | None] = mapped_column(String(80))
    notes: Mapped[str | None] = mapped_column(Text)
