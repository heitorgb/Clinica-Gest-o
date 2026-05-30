from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

InventoryMovementType = Literal["in", "out", "adjustment"]


class InventoryItemBase(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    sku: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=80)
    unit: str = Field(default="un", min_length=1, max_length=24)
    current_quantity: Decimal = Field(
        default=Decimal("0.000"),
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    minimum_quantity: Decimal = Field(
        default=Decimal("0.000"),
        ge=0,
        max_digits=12,
        decimal_places=3,
    )
    cost_price: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    supplier: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool = True

    @field_validator("name", "sku", "category", "unit", "supplier", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class InventoryItemCreate(InventoryItemBase):
    pass


class InventoryItemUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    sku: str | None = Field(default=None, max_length=80)
    category: str | None = Field(default=None, max_length=80)
    unit: str | None = Field(default=None, min_length=1, max_length=24)
    minimum_quantity: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=3)
    cost_price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    supplier: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    is_active: bool | None = None

    @field_validator("name", "sku", "category", "unit", "supplier", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class InventoryItemPublic(BaseModel):
    id: UUID
    name: str
    sku: str | None = None
    category: str | None = None
    unit: str
    current_quantity: Decimal
    minimum_quantity: Decimal
    cost_price: Decimal
    supplier: str | None = None
    notes: str | None = None
    is_active: bool
    stock_status: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventoryMovementCreate(BaseModel):
    item_id: UUID
    movement_type: InventoryMovementType
    quantity: Decimal = Field(gt=0, max_digits=12, decimal_places=3)
    unit_cost: Decimal = Field(default=Decimal("0.00"), ge=0, max_digits=12, decimal_places=2)
    reason: str | None = Field(default=None, max_length=160)
    notes: str | None = Field(default=None, max_length=2000)
    occurred_at: datetime | None = None

    @field_validator("reason", "notes", mode="before")
    @classmethod
    def strip_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        return value or None


class InventoryMovementPublic(BaseModel):
    id: UUID
    item_id: UUID
    movement_type: str
    quantity: Decimal
    unit_cost: Decimal
    reason: str | None = None
    notes: str | None = None
    occurred_at: datetime
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InventorySummary(BaseModel):
    total_items: int
    low_stock_items: int
    inactive_items: int
    total_stock_value: Decimal
