from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator

IntegrationProvider = Literal["openai", "whatsapp", "mcp"]
IntegrationCategory = Literal["ai", "messaging", "connector"]
IntegrationStatus = Literal["ready", "missing_config"]
AiUseCase = Literal["lead_follow_up", "dashboard_insight", "financial_summary"]


class IntegrationProviderStatus(BaseModel):
    provider: IntegrationProvider
    category: IntegrationCategory
    configured: bool
    status: IntegrationStatus
    capabilities: list[str] = Field(default_factory=list)


class IntegrationsStatus(BaseModel):
    providers: list[IntegrationProviderStatus]


class McpConnectorSettingsPublic(BaseModel):
    connector_enabled: bool
    write_tools_enabled: bool
    audit_enabled: bool
    auth_enabled: bool
    auth_token_configured: bool
    auth_token_preview: str | None = None
    allow_query_token: bool
    server_name: str
    updated_at: datetime | None = None


class McpConnectorSettingsUpdate(BaseModel):
    connector_enabled: bool | None = None
    write_tools_enabled: bool | None = None
    audit_enabled: bool | None = None
    auth_enabled: bool | None = None
    auth_token: str | None = Field(default=None, min_length=24, max_length=255)
    allow_query_token: bool | None = None
    server_name: str | None = Field(default=None, min_length=2, max_length=120)

    @field_validator("auth_token", "server_name", mode="before")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class AiPreviewRequest(BaseModel):
    provider: Literal["openai", "anthropic"] = "openai"
    use_case: AiUseCase
    instruction: str = Field(min_length=2, max_length=1000)
    context: dict[str, str] = Field(default_factory=dict)


class AiPreviewResponse(BaseModel):
    provider: str
    use_case: str
    system_prompt: str
    user_prompt: str
    ready_to_send: bool


class AiGenerateRequest(BaseModel):
    provider: Literal["anthropic"] = "anthropic"
    use_case: AiUseCase
    instruction: str = Field(min_length=2, max_length=1000)
    context: dict[str, str] = Field(default_factory=dict)
    max_tokens: int = Field(default=512, ge=64, le=2048)


class AiGenerateResponse(BaseModel):
    provider: str
    use_case: str
    model: str
    generated_text: str
    input_tokens: int | None = None
    output_tokens: int | None = None
    request_id: str | None = None


class WhatsAppPreviewRequest(BaseModel):
    phone: str = Field(min_length=8, max_length=32)
    message: str = Field(min_length=2, max_length=1000)
    contact_name: str | None = Field(default=None, max_length=160)


class WhatsAppPreviewResponse(BaseModel):
    provider: str = "whatsapp"
    phone: str
    message: str
    character_count: int
    ready_to_send: bool
