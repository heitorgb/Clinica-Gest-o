import re
from typing import Any

import httpx
from fastapi import HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.integrations.schemas import (
    AiGenerateRequest,
    AiGenerateResponse,
    AiPreviewRequest,
    AiPreviewResponse,
    IntegrationCategory,
    IntegrationProvider,
    IntegrationProviderStatus,
    IntegrationsStatus,
    McpConnectorSettingsPublic,
    McpConnectorSettingsUpdate,
    WhatsAppPreviewRequest,
    WhatsAppPreviewResponse,
)
from app.modules.mcp.models import McpConnectorSettings
from app.modules.mcp.repository import (
    DEFAULT_MCP_SETTINGS_SCOPE,
    get_mcp_connector_settings,
    save_mcp_connector_settings,
)

AI_CAPABILITIES = [
    "gerar resumo gerencial",
    "sugerir proximos passos comerciais",
    "rascunhar mensagens administrativas",
]
WHATSAPP_CAPABILITIES = [
    "preparar mensagem de follow-up",
    "preparar lembrete financeiro",
    "base futura para automacoes",
]
MCP_CAPABILITIES = [
    "consultar indicadores pelo Claude",
    "executar acoes administrativas autorizadas",
    "registrar auditoria de chamadas",
]

AI_SYSTEM_PROMPTS = {
    "lead_follow_up": (
        "Voce apoia a equipe comercial de uma clinica. Gere mensagens administrativas, "
        "objetivas e respeitosas, sem orientacao medica."
    ),
    "dashboard_insight": (
        "Voce apoia a gestao administrativa de uma clinica. Analise indicadores de CRM, "
        "financeiro e estoque de forma executiva."
    ),
    "financial_summary": (
        "Voce apoia a area financeira de uma clinica. Resuma contas, vencimentos e "
        "pendencias sem alterar dados de origem."
    ),
}


def has_secret(value: str | None) -> bool:
    return bool(value and value.strip())


def require_secret(value: str | None, name: str) -> str:
    if not has_secret(value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{name} nao configurada.",
        )

    return value.strip()


def provider_status(
    provider: IntegrationProvider,
    category: IntegrationCategory,
    configured: bool,
) -> IntegrationProviderStatus:
    capabilities_by_category = {
        "ai": AI_CAPABILITIES,
        "connector": MCP_CAPABILITIES,
        "messaging": WHATSAPP_CAPABILITIES,
    }
    return IntegrationProviderStatus(
        provider=provider,
        category=category,
        configured=configured,
        status="ready" if configured else "missing_config",
        capabilities=capabilities_by_category[category],
    )


def get_integrations_status(
    settings: Settings,
    mcp_settings: Settings | None = None,
) -> IntegrationsStatus:
    effective_mcp_settings = mcp_settings or settings
    mcp_configured = effective_mcp_settings.mcp_connector_enabled and (
        not effective_mcp_settings.mcp_auth_enabled
        or has_secret(effective_mcp_settings.mcp_auth_token)
    )

    return IntegrationsStatus(
        providers=[
            provider_status("openai", "ai", has_secret(settings.openai_api_key)),
            provider_status("whatsapp", "messaging", has_secret(settings.whatsapp_api_token)),
            provider_status("mcp", "connector", mcp_configured),
        ]
    )


def mask_secret(value: str | None) -> str | None:
    if not has_secret(value):
        return None

    secret = value.strip()
    if len(secret) <= 12:
        return f"{secret[:2]}...{secret[-2:]}"

    return f"{secret[:6]}...{secret[-4:]}"


def create_mcp_settings_from_environment(settings: Settings) -> McpConnectorSettings:
    return McpConnectorSettings(
        scope=DEFAULT_MCP_SETTINGS_SCOPE,
        connector_enabled=settings.mcp_connector_enabled,
        write_tools_enabled=settings.mcp_write_tools_enabled,
        audit_enabled=settings.mcp_audit_enabled,
        auth_enabled=settings.mcp_auth_enabled,
        auth_token=settings.mcp_auth_token,
        allow_query_token=settings.mcp_allow_query_token,
        server_name=settings.mcp_server_name,
    )


def apply_mcp_settings(settings: Settings, record: McpConnectorSettings | None) -> Settings:
    if record is None:
        return settings

    return settings.model_copy(
        update={
            "mcp_connector_enabled": record.connector_enabled,
            "mcp_write_tools_enabled": record.write_tools_enabled,
            "mcp_audit_enabled": record.audit_enabled,
            "mcp_auth_enabled": record.auth_enabled,
            "mcp_auth_token": record.auth_token,
            "mcp_allow_query_token": record.allow_query_token,
            "mcp_server_name": record.server_name,
        }
    )


def resolve_mcp_settings(db: Session, settings: Settings) -> Settings:
    if settings.app_env == "test":
        return settings

    try:
        return apply_mcp_settings(settings, get_mcp_connector_settings(db))
    except SQLAlchemyError:
        db.rollback()
        return settings


def get_or_create_mcp_connector_settings(
    db: Session,
    settings: Settings,
) -> McpConnectorSettings:
    record = get_mcp_connector_settings(db)

    if record is not None:
        return record

    return save_mcp_connector_settings(db, create_mcp_settings_from_environment(settings))


def to_mcp_settings_public(record: McpConnectorSettings) -> McpConnectorSettingsPublic:
    return McpConnectorSettingsPublic(
        connector_enabled=record.connector_enabled,
        write_tools_enabled=record.write_tools_enabled,
        audit_enabled=record.audit_enabled,
        auth_enabled=record.auth_enabled,
        auth_token_configured=has_secret(record.auth_token),
        auth_token_preview=mask_secret(record.auth_token),
        allow_query_token=record.allow_query_token,
        server_name=record.server_name,
        updated_at=record.updated_at,
    )


def update_mcp_connector_settings(
    db: Session,
    settings: Settings,
    payload: McpConnectorSettingsUpdate,
) -> McpConnectorSettings:
    record = get_or_create_mcp_connector_settings(db, settings)
    update_data = payload.model_dump(exclude_unset=True)

    auth_token = update_data.pop("auth_token", None)
    if auth_token is not None:
        record.auth_token = auth_token

    for field, value in update_data.items():
        setattr(record, field, value)

    if record.auth_enabled and not has_secret(record.auth_token):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Informe um token MCP antes de ativar autenticacao.",
        )

    return save_mcp_connector_settings(db, record)


def build_context_block(context: dict[str, str]) -> str:
    if not context:
        return "Contexto: nenhum dado adicional informado."

    lines = [f"- {key}: {value}" for key, value in sorted(context.items())]
    return "Contexto:\n" + "\n".join(lines)


def build_ai_preview(payload: AiPreviewRequest, settings: Settings) -> AiPreviewResponse:
    provider_key = f"{payload.provider}_api_key"
    ready_to_send = has_secret(getattr(settings, provider_key))

    user_prompt = (
        f"Objetivo: {payload.instruction.strip()}\n\n"
        f"{build_context_block(payload.context)}\n\n"
        "Retorne uma resposta curta, clara e pronta para revisao humana."
    )

    return AiPreviewResponse(
        provider=payload.provider,
        use_case=payload.use_case,
        system_prompt=AI_SYSTEM_PROMPTS[payload.use_case],
        user_prompt=user_prompt,
        ready_to_send=ready_to_send,
    )


def build_anthropic_body(payload: AiGenerateRequest, settings: Settings) -> dict[str, Any]:
    preview = build_ai_preview(
        AiPreviewRequest(
            provider=payload.provider,
            use_case=payload.use_case,
            instruction=payload.instruction,
            context=payload.context,
        ),
        settings,
    )

    return {
        "model": settings.anthropic_model,
        "max_tokens": payload.max_tokens,
        "system": preview.system_prompt,
        "messages": [
            {
                "role": "user",
                "content": preview.user_prompt,
            }
        ],
    }


def extract_anthropic_text(data: dict[str, Any]) -> str:
    content = data.get("content")

    if not isinstance(content, list):
        return ""

    text_blocks = [
        block.get("text", "")
        for block in content
        if isinstance(block, dict) and block.get("type") == "text"
    ]

    return "\n".join(text.strip() for text in text_blocks if text.strip())


def parse_anthropic_error(data: dict[str, Any]) -> str:
    error = data.get("error")

    if isinstance(error, dict) and isinstance(error.get("message"), str):
        return error["message"]

    if isinstance(data.get("detail"), str):
        return str(data["detail"])

    return "Nao foi possivel gerar resposta com Claude."


def post_anthropic_message(
    body: dict[str, Any],
    settings: Settings,
    client: httpx.Client | None = None,
) -> httpx.Response:
    api_key = require_secret(settings.anthropic_api_key, "ANTHROPIC_API_KEY")
    headers = {
        "x-api-key": api_key,
        "anthropic-version": settings.anthropic_api_version,
        "content-type": "application/json",
    }

    if client is not None:
        return client.post(settings.anthropic_api_url, headers=headers, json=body)

    with httpx.Client(timeout=settings.anthropic_timeout_seconds) as http_client:
        return http_client.post(settings.anthropic_api_url, headers=headers, json=body)


def generate_ai_response(
    payload: AiGenerateRequest,
    settings: Settings,
    client: httpx.Client | None = None,
) -> AiGenerateResponse:
    body = build_anthropic_body(payload, settings)

    try:
        response = post_anthropic_message(body, settings, client)
    except httpx.HTTPError as request_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Nao foi possivel conectar ao Claude.",
        ) from request_error

    try:
        data = response.json()
    except ValueError as parse_error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Claude retornou uma resposta invalida.",
        ) from parse_error

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Claude retornou erro: {parse_anthropic_error(data)}",
        )

    generated_text = extract_anthropic_text(data)

    if not generated_text:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Claude nao retornou texto.",
        )

    usage = data.get("usage", {})
    input_tokens = usage.get("input_tokens") if isinstance(usage, dict) else None
    output_tokens = usage.get("output_tokens") if isinstance(usage, dict) else None

    return AiGenerateResponse(
        provider=payload.provider,
        use_case=payload.use_case,
        model=str(data.get("model") or settings.anthropic_model),
        generated_text=generated_text,
        input_tokens=input_tokens if isinstance(input_tokens, int) else None,
        output_tokens=output_tokens if isinstance(output_tokens, int) else None,
        request_id=response.headers.get("request-id"),
    )


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone)
    if phone.strip().startswith("+"):
        return f"+{digits}"
    return digits


def build_whatsapp_preview(
    payload: WhatsAppPreviewRequest,
    settings: Settings,
) -> WhatsAppPreviewResponse:
    message = payload.message.strip()

    if payload.contact_name:
        message = message.replace("{nome}", payload.contact_name.strip())

    return WhatsAppPreviewResponse(
        phone=normalize_phone(payload.phone),
        message=message,
        character_count=len(message),
        ready_to_send=has_secret(settings.whatsapp_api_token),
    )
