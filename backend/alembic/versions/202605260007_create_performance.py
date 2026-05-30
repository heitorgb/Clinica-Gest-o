"""create performance

Revision ID: 202605260007
Revises: 202605260006
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260007"
down_revision: str | None = "202605260006"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "performance_goals",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("metric", sa.String(length=40), nullable=False),
        sa.Column("target_value", sa.Numeric(12, 2), nullable=False),
        sa.Column("current_value", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("period_start", sa.Date(), nullable=False),
        sa.Column("period_end", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="active", nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
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
            "metric in ('revenue', 'leads', 'won_leads', 'conversion')",
            name=op.f("ck_performance_goals_performance_goal_metric_valid"),
        ),
        sa.CheckConstraint(
            "status in ('active', 'completed', 'paused', 'canceled')",
            name=op.f("ck_performance_goals_performance_goal_status_valid"),
        ),
        sa.CheckConstraint(
            "target_value > 0",
            name=op.f("ck_performance_goals_performance_goal_target_value_valid"),
        ),
        sa.CheckConstraint(
            "current_value >= 0",
            name=op.f("ck_performance_goals_performance_goal_current_value_valid"),
        ),
        sa.CheckConstraint(
            "period_end >= period_start",
            name=op.f("ck_performance_goals_performance_goal_period_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_performance_goals_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_performance_goals")),
    )
    op.create_table(
        "commissions",
        sa.Column("description", sa.String(length=180), nullable=False),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
        sa.Column("base_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("percentage", sa.Numeric(5, 2), nullable=False),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("reference_date", sa.Date(), nullable=False),
        sa.Column("status", sa.String(length=20), server_default="pending", nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
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
            "status in ('pending', 'approved', 'paid', 'canceled')",
            name=op.f("ck_commissions_commission_status_valid"),
        ),
        sa.CheckConstraint(
            "base_amount >= 0",
            name=op.f("ck_commissions_commission_base_amount_valid"),
        ),
        sa.CheckConstraint(
            "percentage >= 0",
            name=op.f("ck_commissions_commission_percentage_valid"),
        ),
        sa.CheckConstraint("amount >= 0", name=op.f("ck_commissions_commission_amount_valid")),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_commissions_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_commissions")),
    )
    op.create_index(op.f("ix_commissions_owner_id"), "commissions", ["owner_id"], unique=False)
    op.create_index(op.f("ix_commissions_status"), "commissions", ["status"], unique=False)
    op.create_index(
        op.f("ix_performance_goals_owner_id"),
        "performance_goals",
        ["owner_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_performance_goals_status"),
        "performance_goals",
        ["status"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_performance_goals_status"), table_name="performance_goals")
    op.drop_index(op.f("ix_performance_goals_owner_id"), table_name="performance_goals")
    op.drop_index(op.f("ix_commissions_status"), table_name="commissions")
    op.drop_index(op.f("ix_commissions_owner_id"), table_name="commissions")
    op.drop_table("commissions")
    op.drop_table("performance_goals")
