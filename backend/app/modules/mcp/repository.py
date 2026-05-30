from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.mcp.models import McpAuditLog, McpConnectorSettings

DEFAULT_MCP_SETTINGS_SCOPE = "default"


def create_mcp_audit_log(db: Session, audit_log: McpAuditLog) -> McpAuditLog:
    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)
    return audit_log


def list_mcp_audit_logs(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    tool_name: str | None = None,
    success: bool | None = None,
    is_write_tool: bool | None = None,
) -> list[McpAuditLog]:
    statement = select(McpAuditLog).order_by(McpAuditLog.created_at.desc())

    if tool_name:
        statement = statement.where(McpAuditLog.tool_name == tool_name)

    if success is not None:
        statement = statement.where(McpAuditLog.success == success)

    if is_write_tool is not None:
        statement = statement.where(McpAuditLog.is_write_tool == is_write_tool)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def get_mcp_connector_settings(db: Session) -> McpConnectorSettings | None:
    statement = select(McpConnectorSettings).where(
        McpConnectorSettings.scope == DEFAULT_MCP_SETTINGS_SCOPE
    )
    return db.execute(statement).scalar_one_or_none()


def save_mcp_connector_settings(
    db: Session,
    settings: McpConnectorSettings,
) -> McpConnectorSettings:
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
