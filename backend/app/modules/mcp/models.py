from datetime import datetime
from uuid import UUID

from sqlalchemy import JSON, Boolean, DateTime, Integer, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class McpAuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_audit_logs"

    tool_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    request_id: Mapped[str | None] = mapped_column(String(120))
    is_write_tool: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    success: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, index=True)
    arguments: Mapped[dict | None] = mapped_column(JSON)
    result_summary: Mapped[dict | None] = mapped_column(JSON)
    error_message: Mapped[str | None] = mapped_column(Text)
    remote_addr: Mapped[str | None] = mapped_column(String(80))
    user_agent: Mapped[str | None] = mapped_column(String(255))
    elapsed_ms: Mapped[int | None] = mapped_column(Integer)


class McpConnectorSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_connector_settings"

    scope: Mapped[str] = mapped_column(String(32), nullable=False, unique=True, default="default")
    connector_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    write_tools_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    audit_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auth_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    auth_token: Mapped[str | None] = mapped_column(String(255))
    allow_query_token: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    server_name: Mapped[str] = mapped_column(String(120), nullable=False, default="clinica-gestao")


class McpOAuthClient(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_oauth_clients"

    client_id: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    client_name: Mapped[str | None] = mapped_column(String(160))
    redirect_uris: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    grant_types: Mapped[list[str] | None] = mapped_column(JSON)
    response_types: Mapped[list[str] | None] = mapped_column(JSON)
    token_endpoint_auth_method: Mapped[str] = mapped_column(
        String(80),
        nullable=False,
        default="none",
    )


class McpOAuthAuthorizationCode(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_oauth_authorization_codes"

    code: Mapped[str] = mapped_column(String(160), nullable=False, unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    redirect_uri: Mapped[str] = mapped_column(String(500), nullable=False)
    code_challenge: Mapped[str] = mapped_column(String(160), nullable=False)
    code_challenge_method: Mapped[str] = mapped_column(String(16), nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class McpOAuthRefreshToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "mcp_oauth_refresh_tokens"

    token_hash: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    client_id: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    user_id: Mapped[UUID] = mapped_column(Uuid(as_uuid=True), nullable=False)
    scope: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
