"""create financial transactions

Revision ID: 202605260005
Revises: 202605260004
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260005"
down_revision: str | None = "202605260004"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "financial_transactions",
        sa.Column("description", sa.String(length=180), nullable=False),
        sa.Column("transaction_type", sa.String(length=20), nullable=False),
        sa.Column("category", sa.String(length=80), nullable=False),
        sa.Column("counterparty", sa.String(length=160), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("due_date", sa.Date(), nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("payment_method", sa.String(length=80), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "transaction_type in ('receivable', 'payable')",
            name=op.f("ck_financial_transactions_financial_transaction_type_valid"),
        ),
        sa.CheckConstraint(
            "status in ('open', 'paid', 'overdue', 'canceled')",
            name=op.f("ck_financial_transactions_financial_transaction_status_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_financial_transactions")),
    )
    op.create_index(
        op.f("ix_financial_transactions_due_date"),
        "financial_transactions",
        ["due_date"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_transactions_status"),
        "financial_transactions",
        ["status"],
        unique=False,
    )
    op.create_index(
        op.f("ix_financial_transactions_transaction_type"),
        "financial_transactions",
        ["transaction_type"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_financial_transactions_transaction_type"),
        table_name="financial_transactions",
    )
    op.drop_index(op.f("ix_financial_transactions_status"), table_name="financial_transactions")
    op.drop_index(op.f("ix_financial_transactions_due_date"), table_name="financial_transactions")
    op.drop_table("financial_transactions")
