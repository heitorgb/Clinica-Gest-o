from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modules.inventory.models import InventoryItem, InventoryMovement


def list_inventory_items(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    category: str | None = None,
    low_stock: bool | None = None,
    is_active: bool | None = None,
) -> list[InventoryItem]:
    statement = select(InventoryItem).order_by(InventoryItem.name).offset(skip).limit(limit)

    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                InventoryItem.name.ilike(pattern),
                InventoryItem.sku.ilike(pattern),
                InventoryItem.supplier.ilike(pattern),
            )
        )

    if category:
        statement = statement.where(InventoryItem.category == category)

    if low_stock is not None:
        condition = InventoryItem.current_quantity <= InventoryItem.minimum_quantity
        statement = statement.where(condition if low_stock else ~condition)

    if is_active is not None:
        statement = statement.where(InventoryItem.is_active == is_active)

    return list(db.execute(statement).scalars().all())


def get_inventory_item_by_id(db: Session, item_id: UUID) -> InventoryItem | None:
    statement = select(InventoryItem).where(InventoryItem.id == item_id)
    return db.execute(statement).scalar_one_or_none()


def get_inventory_item_by_sku(db: Session, sku: str) -> InventoryItem | None:
    statement = select(InventoryItem).where(InventoryItem.sku == sku.strip())
    return db.execute(statement).scalar_one_or_none()


def list_inventory_movements(
    db: Session,
    *,
    item_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[InventoryMovement]:
    statement = (
        select(InventoryMovement)
        .options(selectinload(InventoryMovement.item))
        .order_by(InventoryMovement.occurred_at.desc())
    )

    if item_id:
        statement = statement.where(InventoryMovement.item_id == item_id)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def count_inventory_items(db: Session, *, is_active: bool | None = None) -> int:
    statement = select(func.count(InventoryItem.id))

    if is_active is not None:
        statement = statement.where(InventoryItem.is_active == is_active)

    return db.execute(statement).scalar_one()


def count_low_stock_items(db: Session) -> int:
    statement = select(func.count(InventoryItem.id)).where(
        InventoryItem.is_active.is_(True),
        InventoryItem.current_quantity <= InventoryItem.minimum_quantity,
    )
    return db.execute(statement).scalar_one()


def sum_inventory_value(db: Session) -> Decimal:
    statement = select(
        func.coalesce(func.sum(InventoryItem.current_quantity * InventoryItem.cost_price), 0)
    ).where(InventoryItem.is_active.is_(True))
    value = db.execute(statement).scalar_one()
    return Decimal(value)
