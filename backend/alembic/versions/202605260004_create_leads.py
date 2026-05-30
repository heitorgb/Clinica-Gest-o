"""create leads

Revision ID: 202605260004
Revises: 202605260003
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260004"
down_revision: str | None = "202605260003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "leads",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("phone", sa.String(length=32), nullable=True),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("origin", sa.String(length=80), nullable=True),
        sa.Column("stage", sa.String(length=40), server_default="novo", nullable=False),
        sa.Column("status", sa.String(length=20), server_default="open", nullable=False),
        sa.Column("estimated_value", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("next_follow_up_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_contact_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("owner_id", sa.Uuid(), nullable=True),
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
            "stage in ('novo', 'contato', 'qualificacao', 'proposta', 'negociacao')",
            name=op.f("ck_leads_lead_stage_valid"),
        ),
        sa.CheckConstraint(
            "status in ('open', 'won', 'lost')",
            name=op.f("ck_leads_lead_status_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_leads_owner_id_users"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_leads")),
    )
    op.create_index(op.f("ix_leads_created_at"), "leads", ["created_at"], unique=False)
    op.create_index(op.f("ix_leads_owner_id"), "leads", ["owner_id"], unique=False)
    op.create_index(op.f("ix_leads_stage"), "leads", ["stage"], unique=False)
    op.create_index(op.f("ix_leads_status"), "leads", ["status"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_leads_status"), table_name="leads")
    op.drop_index(op.f("ix_leads_stage"), table_name="leads")
    op.drop_index(op.f("ix_leads_owner_id"), table_name="leads")
    op.drop_index(op.f("ix_leads_created_at"), table_name="leads")
    op.drop_table("leads")
