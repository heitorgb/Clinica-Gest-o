from sqlalchemy import JSON, Boolean, Integer, String, Text
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
