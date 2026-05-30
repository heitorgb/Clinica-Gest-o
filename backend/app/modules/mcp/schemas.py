from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict


class McpAuditLogPublic(BaseModel):
    id: UUID
    tool_name: str
    request_id: str | None = None
    is_write_tool: bool
    success: bool
    arguments: dict | None = None
    result_summary: dict | None = None
    error_message: str | None = None
    remote_addr: str | None = None
    user_agent: str | None = None
    elapsed_ms: int | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
