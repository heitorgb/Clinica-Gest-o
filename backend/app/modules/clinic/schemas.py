from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator


class ClinicSettingsBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    legal_name: str | None = Field(default=None, max_length=180)
    document: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    timezone: str = Field(default="America/Sao_Paulo", min_length=3, max_length=64)
    currency: str = Field(default="BRL", min_length=3, max_length=3)

    @field_validator("name", "timezone", "currency", mode="before")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        return value.strip()

    @field_validator("legal_name", "document", "phone", "email", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str) -> str:
        return value.upper()


class ClinicSettingsUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    legal_name: str | None = Field(default=None, max_length=180)
    document: str | None = Field(default=None, max_length=32)
    phone: str | None = Field(default=None, max_length=32)
    email: str | None = Field(default=None, max_length=255)
    timezone: str | None = Field(default=None, min_length=3, max_length=64)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

    @field_validator("name", "timezone", "currency", mode="before")
    @classmethod
    def strip_required_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.strip()

    @field_validator("legal_name", "document", "phone", "email", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None

    @field_validator("currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return value.upper()


class ClinicSettingsPublic(ClinicSettingsBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
