"""create clinic settings

Revision ID: 202605260001
Revises:
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "clinic_settings",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("legal_name", sa.String(length=180), nullable=True),
        sa.Column("document", sa.String(length=32), nullable=True),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column(
            "timezone",
            sa.String(length=64),
            server_default="America/Sao_Paulo",
            nullable=False,
        ),
        sa.Column("currency", sa.String(length=3), server_default="BRL", nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clinic_settings")),
    )


def downgrade() -> None:
    op.drop_table("clinic_settings")
