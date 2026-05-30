from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

GoalMetric = Literal["revenue", "leads", "won_leads", "conversion"]
GoalStatus = Literal["active", "completed", "paused", "canceled"]
CommissionStatus = Literal["pending", "approved", "paid", "canceled"]


class PerformanceGoalBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    metric: GoalMetric
    target_value: Decimal = Field(gt=0, max_digits=12, decimal_places=2)
    current_value: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    period_start: date
    period_end: date
    status: GoalStatus = "active"
    owner_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class PerformanceGoalCreate(PerformanceGoalBase):
    pass


class PerformanceGoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    metric: GoalMetric | None = None
    target_value: Decimal | None = Field(default=None, gt=0, max_digits=12, decimal_places=2)
    current_value: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    period_start: date | None = None
    period_end: date | None = None
    status: GoalStatus | None = None
    owner_id: UUID | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("name", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class PerformanceGoalPublic(BaseModel):
    id: UUID
    name: str
    metric: str
    target_value: Decimal
    current_value: Decimal
    progress_percent: Decimal
    period_start: date
    period_end: date
    status: str
    owner_id: UUID | None = None
    owner_name: str | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CommissionBase(BaseModel):
    description: str = Field(min_length=2, max_length=180)
    owner_id: UUID | None = None
    base_amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    percentage: Decimal = Field(ge=0, max_digits=5, decimal_places=2)
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    reference_date: date
    status: CommissionStatus = "pending"
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("description", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CommissionCreate(CommissionBase):
    pass


class CommissionUpdate(BaseModel):
    description: str | None = Field(default=None, min_length=2, max_length=180)
    owner_id: UUID | None = None
    base_amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    percentage: Decimal | None = Field(default=None, ge=0, max_digits=5, decimal_places=2)
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    reference_date: date | None = None
    status: CommissionStatus | None = None
    paid_at: datetime | None = None
    notes: str | None = Field(default=None, max_length=2000)

    @field_validator("description", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class CommissionPublic(BaseModel):
    id: UUID
    description: str
    owner_id: UUID | None = None
    owner_name: str | None = None
    base_amount: Decimal
    percentage: Decimal
    amount: Decimal
    reference_date: date
    status: str
    paid_at: datetime | None = None
    notes: str | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PerformanceSummary(BaseModel):
    active_goals: int
    completed_goals: int
    average_progress: Decimal
    pending_commissions: Decimal
    approved_commissions: Decimal
    paid_commissions: Decimal
