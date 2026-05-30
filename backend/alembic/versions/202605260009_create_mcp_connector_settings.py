"""create mcp connector settings

Revision ID: 202605260009
Revises: 202605260008
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260009"
down_revision: str | None = "202605260008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_connector_settings",
        sa.Column("scope", sa.String(length=32), nullable=False),
        sa.Column("connector_enabled", sa.Boolean(), nullable=False),
        sa.Column("write_tools_enabled", sa.Boolean(), nullable=False),
        sa.Column("audit_enabled", sa.Boolean(), nullable=False),
        sa.Column("auth_enabled", sa.Boolean(), nullable=False),
        sa.Column("auth_token", sa.String(length=255), nullable=True),
        sa.Column("allow_query_token", sa.Boolean(), nullable=False),
        sa.Column("server_name", sa.String(length=120), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mcp_connector_settings")),
        sa.UniqueConstraint("scope", name=op.f("uq_mcp_connector_settings_scope")),
    )


def downgrade() -> None:
    op.drop_table("mcp_connector_settings")
