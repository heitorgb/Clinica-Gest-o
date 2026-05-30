from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

LeadStage = Literal["novo", "contato", "qualificacao", "proposta", "negociacao"]
LeadStatus = Literal["open", "won", "lost"]


class LeadBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    origin: str | None = Field(default=None, max_length=80)
    stage: LeadStage = "novo"
    status: LeadStatus = "open"
    estimated_value: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=2000)
    next_follow_up_at: datetime | None = None
    last_contact_at: datetime | None = None
    owner_id: UUID | None = None

    @field_validator("name", "phone", "origin", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadCreate(LeadBase):
    pass


class LeadUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    phone: str | None = Field(default=None, max_length=32)
    email: EmailStr | None = None
    origin: str | None = Field(default=None, max_length=80)
    stage: LeadStage | None = None
    status: LeadStatus | None = None
    estimated_value: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    notes: str | None = Field(default=None, max_length=2000)
    next_follow_up_at: datetime | None = None
    last_contact_at: datetime | None = None
    owner_id: UUID | None = None

    @field_validator("name", "phone", "origin", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class LeadPublic(BaseModel):
    id: UUID
    name: str
    phone: str | None = None
    email: str | None = None
    origin: str | None = None
    stage: str
    status: str
    estimated_value: Decimal
    notes: str | None = None
    next_follow_up_at: datetime | None = None
    last_contact_at: datetime | None = None
    owner_id: UUID | None = None
    owner_name: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PipelineStageSummary(BaseModel):
    stage: str
    leads_count: int
    estimated_value: Decimal
