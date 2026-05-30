"""create mcp oauth tables

Revision ID: 202605260010
Revises: 202605260009
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260010"
down_revision: str | None = "202605260009"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "mcp_oauth_clients",
        sa.Column("client_id", sa.String(length=160), nullable=False),
        sa.Column("client_name", sa.String(length=160), nullable=True),
        sa.Column("redirect_uris", sa.JSON(), nullable=False),
        sa.Column("grant_types", sa.JSON(), nullable=True),
        sa.Column("response_types", sa.JSON(), nullable=True),
        sa.Column("token_endpoint_auth_method", sa.String(length=80), nullable=False),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mcp_oauth_clients")),
        sa.UniqueConstraint("client_id", name=op.f("uq_mcp_oauth_clients_client_id")),
    )
    op.create_index(
        op.f("ix_mcp_oauth_clients_client_id"),
        "mcp_oauth_clients",
        ["client_id"],
    )

    op.create_table(
        "mcp_oauth_authorization_codes",
        sa.Column("code", sa.String(length=160), nullable=False),
        sa.Column("client_id", sa.String(length=160), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("redirect_uri", sa.String(length=500), nullable=False),
        sa.Column("code_challenge", sa.String(length=160), nullable=False),
        sa.Column("code_challenge_method", sa.String(length=16), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mcp_oauth_authorization_codes")),
        sa.UniqueConstraint("code", name=op.f("uq_mcp_oauth_authorization_codes_code")),
    )
    op.create_index(
        op.f("ix_mcp_oauth_authorization_codes_client_id"),
        "mcp_oauth_authorization_codes",
        ["client_id"],
    )
    op.create_index(
        op.f("ix_mcp_oauth_authorization_codes_code"),
        "mcp_oauth_authorization_codes",
        ["code"],
    )

    op.create_table(
        "mcp_oauth_refresh_tokens",
        sa.Column("token_hash", sa.String(length=128), nullable=False),
        sa.Column("client_id", sa.String(length=160), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("scope", sa.String(length=255), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
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
        sa.PrimaryKeyConstraint("id", name=op.f("pk_mcp_oauth_refresh_tokens")),
        sa.UniqueConstraint("token_hash", name=op.f("uq_mcp_oauth_refresh_tokens_token_hash")),
    )
    op.create_index(
        op.f("ix_mcp_oauth_refresh_tokens_client_id"),
        "mcp_oauth_refresh_tokens",
        ["client_id"],
    )
    op.create_index(
        op.f("ix_mcp_oauth_refresh_tokens_token_hash"),
        "mcp_oauth_refresh_tokens",
        ["token_hash"],
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_mcp_oauth_refresh_tokens_token_hash"),
        table_name="mcp_oauth_refresh_tokens",
    )
    op.drop_index(
        op.f("ix_mcp_oauth_refresh_tokens_client_id"),
        table_name="mcp_oauth_refresh_tokens",
    )
    op.drop_table("mcp_oauth_refresh_tokens")
    op.drop_index(
        op.f("ix_mcp_oauth_authorization_codes_code"),
        table_name="mcp_oauth_authorization_codes",
    )
    op.drop_index(
        op.f("ix_mcp_oauth_authorization_codes_client_id"),
        table_name="mcp_oauth_authorization_codes",
    )
    op.drop_table("mcp_oauth_authorization_codes")
    op.drop_index(op.f("ix_mcp_oauth_clients_client_id"), table_name="mcp_oauth_clients")
    op.drop_table("mcp_oauth_clients")
