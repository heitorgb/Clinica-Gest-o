import httpx
import pytest
from fastapi import HTTPException

from app.core.config import Settings
from app.modules.integrations.schemas import (
    AiGenerateRequest,
    AiPreviewRequest,
    WhatsAppPreviewRequest,
)
from app.modules.integrations.service import (
    build_ai_preview,
    build_whatsapp_preview,
    generate_ai_response,
    get_integrations_status,
    normalize_phone,
)


class FakeAnthropicClient:
    def __init__(self, response: httpx.Response) -> None:
        self.response = response
        self.request_json: dict | None = None
        self.request_headers: dict | None = None
        self.request_url: str | None = None

    def post(self, url: str, *, headers: dict, json: dict) -> httpx.Response:
        self.request_url = url
        self.request_headers = headers
        self.request_json = json
        return self.response


def test_integrations_status_uses_env_configuration() -> None:
    settings = Settings(
        openai_api_key="openai-key",
        anthropic_api_key=None,
        whatsapp_api_token="whatsapp-token",
    )

    status = get_integrations_status(settings)
    providers = {provider.provider: provider for provider in status.providers}

    assert providers["openai"].configured
    assert providers["openai"].status == "ready"
    assert providers["whatsapp"].configured
    assert providers["mcp"].configured


def test_ai_preview_builds_safe_prompt_without_calling_provider() -> None:
    settings = Settings(openai_api_key="openai-key")
    payload = AiPreviewRequest(
        provider="openai",
        use_case="dashboard_insight",
        instruction="Resumir indicadores da semana",
        context={"leads": "109", "saldo": "R$ 57,3 mil"},
    )

    preview = build_ai_preview(payload, settings)

    assert preview.ready_to_send
    assert preview.provider == "openai"
    assert "Resumir indicadores da semana" in preview.user_prompt
    assert "leads: 109" in preview.user_prompt


def test_ai_generate_calls_anthropic_messages_api() -> None:
    response = httpx.Response(
        200,
        json={
            "content": [{"type": "text", "text": "Resumo gerencial pronto."}],
            "model": "claude-sonnet-4-6",
            "usage": {"input_tokens": 30, "output_tokens": 12},
        },
        headers={"request-id": "req_123"},
    )
    client = FakeAnthropicClient(response)
    settings = Settings(anthropic_api_key="anthropic-key")
    payload = AiGenerateRequest(
        provider="anthropic",
        use_case="dashboard_insight",
        instruction="Resuma o dashboard de hoje",
        context={"leads": "12"},
    )

    result = generate_ai_response(payload, settings, client=client)  # type: ignore[arg-type]

    assert result.generated_text == "Resumo gerencial pronto."
    assert result.input_tokens == 30
    assert result.output_tokens == 12
    assert result.request_id == "req_123"
    assert client.request_url == settings.anthropic_api_url
    assert client.request_headers is not None
    assert client.request_headers["x-api-key"] == "anthropic-key"
    assert client.request_headers["anthropic-version"] == "2023-06-01"
    assert client.request_json is not None
    assert client.request_json["model"] == settings.anthropic_model
    assert client.request_json["messages"][0]["role"] == "user"


def test_ai_generate_requires_anthropic_key() -> None:
    payload = AiGenerateRequest(
        provider="anthropic",
        use_case="financial_summary",
        instruction="Resuma os recebimentos em aberto",
    )

    with pytest.raises(HTTPException):
        generate_ai_response(payload, Settings(anthropic_api_key=None))


def test_whatsapp_preview_normalizes_phone_and_replaces_name() -> None:
    settings = Settings(whatsapp_api_token="token")
    payload = WhatsAppPreviewRequest(
        phone="+55 (11) 98888-1040",
        contact_name="Mariana",
        message="Ola, {nome}. Podemos falar sobre sua proposta?",
    )

    preview = build_whatsapp_preview(payload, settings)

    assert preview.ready_to_send
    assert preview.phone == "+5511988881040"
    assert preview.message == "Ola, Mariana. Podemos falar sobre sua proposta?"
    assert preview.character_count == len(preview.message)


def test_normalize_phone_without_plus() -> None:
    assert normalize_phone("(11) 98888-1040") == "11988881040"
