from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    Uuid,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin

INVENTORY_MOVEMENT_TYPES = ("in", "out", "adjustment")


class InventoryItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        CheckConstraint("current_quantity >= 0", name="inventory_item_current_quantity_valid"),
        CheckConstraint("minimum_quantity >= 0", name="inventory_item_minimum_quantity_valid"),
        CheckConstraint("cost_price >= 0", name="inventory_item_cost_price_valid"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    sku: Mapped[str | None] = mapped_column(String(80), unique=True)
    category: Mapped[str | None] = mapped_column(String(80))
    unit: Mapped[str] = mapped_column(String(24), nullable=False, default="un", server_default="un")
    current_quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
        default=Decimal("0.000"),
        server_default="0",
    )
    minimum_quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 3),
        nullable=False,
        default=Decimal("0.000"),
        server_default="0",
    )
    cost_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0",
    )
    supplier: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default="true",
    )
    movements: Mapped[list["InventoryMovement"]] = relationship(
        back_populates="item",
        lazy="selectin",
        cascade="all, delete-orphan",
    )

    @property
    def stock_status(self) -> str:
        if not self.is_active:
            return "inactive"
        if self.current_quantity <= self.minimum_quantity:
            return "low"
        return "ok"


class InventoryMovement(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "inventory_movements"
    __table_args__ = (
        CheckConstraint(
            f"movement_type in {INVENTORY_MOVEMENT_TYPES}",
            name="inventory_movement_type_valid",
        ),
        CheckConstraint("quantity > 0", name="inventory_movement_quantity_valid"),
        CheckConstraint("unit_cost >= 0", name="inventory_movement_unit_cost_valid"),
    )

    item_id: Mapped[UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("inventory_items.id", ondelete="CASCADE"),
        nullable=False,
    )
    movement_type: Mapped[str] = mapped_column(String(20), nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    unit_cost: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0",
    )
    reason: Mapped[str | None] = mapped_column(String(160))
    notes: Mapped[str | None] = mapped_column(Text)
    occurred_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    item: Mapped[InventoryItem] = relationship(back_populates="movements", lazy="selectin")
