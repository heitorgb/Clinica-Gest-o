from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.auth.dependencies import get_current_superuser, require_permission
from app.modules.integrations.schemas import (
    AiGenerateRequest,
    AiGenerateResponse,
    AiPreviewRequest,
    AiPreviewResponse,
    IntegrationsStatus,
    McpConnectorSettingsPublic,
    McpConnectorSettingsUpdate,
    WhatsAppPreviewRequest,
    WhatsAppPreviewResponse,
)
from app.modules.integrations.service import (
    build_ai_preview,
    build_whatsapp_preview,
    generate_ai_response,
    get_integrations_status,
    get_or_create_mcp_connector_settings,
    resolve_mcp_settings,
    to_mcp_settings_public,
    update_mcp_connector_settings,
)
from app.modules.mcp.repository import list_mcp_audit_logs
from app.modules.mcp.schemas import McpAuditLogPublic
from app.modules.users.models import User

router = APIRouter(prefix="/integrations")
require_integrations_access = require_permission("integrations:manage")


@router.get("/status", response_model=IntegrationsStatus, summary="Lista status das integracoes")
def get_integrations_status_endpoint(
    settings: Annotated[Settings, Depends(get_settings)],
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_integrations_access)],
) -> IntegrationsStatus:
    return get_integrations_status(settings, resolve_mcp_settings(db, settings))


@router.post("/ai/preview", response_model=AiPreviewResponse, summary="Prepara prompt de IA")
def build_ai_preview_endpoint(
    payload: AiPreviewRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[User, Depends(require_integrations_access)],
) -> AiPreviewResponse:
    return build_ai_preview(payload, settings)


@router.post(
    "/ai/generate",
    response_model=AiGenerateResponse,
    summary="Gera resposta com IA",
)
def generate_ai_response_endpoint(
    payload: AiGenerateRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[User, Depends(require_integrations_access)],
) -> AiGenerateResponse:
    return generate_ai_response(payload, settings)


@router.post(
    "/whatsapp/preview",
    response_model=WhatsAppPreviewResponse,
    summary="Prepara mensagem de WhatsApp",
)
def build_whatsapp_preview_endpoint(
    payload: WhatsAppPreviewRequest,
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[User, Depends(require_integrations_access)],
) -> WhatsAppPreviewResponse:
    return build_whatsapp_preview(payload, settings)


@router.get(
    "/mcp/settings",
    response_model=McpConnectorSettingsPublic,
    summary="Busca configuracao do conector MCP",
)
def get_mcp_settings_endpoint(
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> McpConnectorSettingsPublic:
    return to_mcp_settings_public(get_or_create_mcp_connector_settings(db, settings))


@router.patch(
    "/mcp/settings",
    response_model=McpConnectorSettingsPublic,
    summary="Atualiza configuracao do conector MCP",
)
def update_mcp_settings_endpoint(
    payload: McpConnectorSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> McpConnectorSettingsPublic:
    return to_mcp_settings_public(update_mcp_connector_settings(db, settings, payload))


@router.get(
    "/mcp/audit-logs",
    response_model=list[McpAuditLogPublic],
    summary="Lista auditoria do conector MCP",
)
def list_mcp_audit_logs_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_integrations_access)],
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
    tool_name: str | None = None,
    success: bool | None = None,
    is_write_tool: bool | None = None,
) -> list[McpAuditLogPublic]:
    return list_mcp_audit_logs(
        db,
        skip=skip,
        limit=limit,
        tool_name=tool_name,
        success=success,
        is_write_tool=is_write_tool,
    )
