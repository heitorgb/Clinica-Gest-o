from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Clinica Gestao API"
    app_env: str = "local"
    app_debug: bool = False

    api_v1_prefix: str = "/api/v1"
    backend_cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: [
            "http://localhost:5173",
            "http://127.0.0.1:5173",
        ],
    )

    database_url: str = "postgresql+psycopg://clinica:clinica_dev_password@localhost:5432/clinica"

    jwt_secret_key: str = "change_me_in_local_env_with_at_least_32_chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    refresh_token_expire_days: int = 7

    first_superuser_name: str | None = "Administrador"
    first_superuser_email: str | None = "admin@example.com"
    first_superuser_password: str | None = "admin12345"

    openai_api_key: str | None = None
    anthropic_api_key: str | None = None
    anthropic_api_url: str = "https://api.anthropic.com/v1/messages"
    anthropic_api_version: str = "2023-06-01"
    anthropic_model: str = "claude-sonnet-4-6"
    anthropic_timeout_seconds: float = 30.0
    whatsapp_api_token: str | None = None

    mcp_connector_enabled: bool = True
    mcp_write_tools_enabled: bool = False
    mcp_audit_enabled: bool = True
    mcp_auth_enabled: bool = False
    mcp_auth_token: str | None = None
    mcp_allow_query_token: bool = True
    mcp_server_name: str = "clinica-gestao"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("api_v1_prefix")
    @classmethod
    def normalize_api_prefix(cls, value: str) -> str:
        value = value.strip()
        if not value.startswith("/"):
            value = f"/{value}"
        return value.rstrip("/")

    @field_validator("backend_cors_origins", mode="before")
    @classmethod
    def parse_cors_origins(cls, value: str | list[str]) -> list[str]:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
