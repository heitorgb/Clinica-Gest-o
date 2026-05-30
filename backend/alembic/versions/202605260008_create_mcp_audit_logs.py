"""create mcp audit logs

Revision ID: 202605260008
Revises: 202605260007
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260008"
down_revision: str | None = "202605260007"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_audit_logs",
        sa.Column("tool_name", sa.String(length=120), nullable=False),
        sa.Column("request_id", sa.String(length=120), nullable=True),
        sa.Column("is_write_tool", sa.Boolean(), nullable=False),
        sa.Column("success", sa.Boolean(), nullable=False),
        sa.Column("arguments", sa.JSON(), nullable=True),
        sa.Column("result_summary", sa.JSON(), nullable=True),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("remote_addr", sa.String(length=80), nullable=True),
        sa.Column("user_agent", sa.String(length=255), nullable=True),
        sa.Column("elapsed_ms", sa.Integer(), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mcp_audit_logs")),
    )
    op.create_index(op.f("ix_mcp_audit_logs_success"), "mcp_audit_logs", ["success"])
    op.create_index(op.f("ix_mcp_audit_logs_tool_name"), "mcp_audit_logs", ["tool_name"])


def downgrade() -> None:
    op.drop_index(op.f("ix_mcp_audit_logs_tool_name"), table_name="mcp_audit_logs")
    op.drop_index(op.f("ix_mcp_audit_logs_success"), table_name="mcp_audit_logs")
    op.drop_table("mcp_audit_logs")
