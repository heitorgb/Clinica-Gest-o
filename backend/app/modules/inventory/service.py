from datetime import UTC, datetime
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.inventory.models import InventoryItem, InventoryMovement
from app.modules.inventory.repository import (
    count_inventory_items,
    count_low_stock_items,
    get_inventory_item_by_id,
    get_inventory_item_by_sku,
    list_inventory_items,
    list_inventory_movements,
    sum_inventory_value,
)
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemUpdate,
    InventoryMovementCreate,
    InventorySummary,
)


def get_inventory_item_or_404(db: Session, item_id: UUID) -> InventoryItem:
    item = get_inventory_item_by_id(db, item_id)
    if item is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item de estoque nao encontrado",
        )
    return item


def ensure_unique_sku(db: Session, sku: str | None, current_item_id: UUID | None = None) -> None:
    if sku is None:
        return

    item = get_inventory_item_by_sku(db, sku)
    if item is not None and item.id != current_item_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="SKU ja cadastrado",
        )


def create_inventory_item(db: Session, payload: InventoryItemCreate) -> InventoryItem:
    ensure_unique_sku(db, payload.sku)

    item = InventoryItem(**payload.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def update_inventory_item(
    db: Session,
    item: InventoryItem,
    payload: InventoryItemUpdate,
) -> InventoryItem:
    data = payload.model_dump(exclude_unset=True)

    if "sku" in data:
        ensure_unique_sku(db, data["sku"], current_item_id=item.id)

    for field, value in data.items():
        setattr(item, field, value)

    db.add(item)
    db.commit()
    db.refresh(item)
    return item


def apply_inventory_movement(item: InventoryItem, movement: InventoryMovementCreate) -> None:
    if movement.movement_type == "in":
        item.current_quantity += movement.quantity
        return

    if movement.movement_type == "out":
        if item.current_quantity < movement.quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Estoque insuficiente",
            )
        item.current_quantity -= movement.quantity
        return

    item.current_quantity = movement.quantity


def create_inventory_movement(
    db: Session,
    payload: InventoryMovementCreate,
) -> InventoryMovement:
    item = get_inventory_item_or_404(db, payload.item_id)
    if not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Item inativo",
        )

    apply_inventory_movement(item, payload)

    data = payload.model_dump()
    if data["occurred_at"] is None:
        data["occurred_at"] = datetime.now(UTC)

    movement = InventoryMovement(**data)
    db.add(item)
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return movement


def list_inventory_items_page(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    category: str | None = None,
    low_stock: bool | None = None,
    is_active: bool | None = None,
) -> list[InventoryItem]:
    return list_inventory_items(
        db,
        skip=skip,
        limit=min(limit, 200),
        search=search,
        category=category,
        low_stock=low_stock,
        is_active=is_active,
    )


def list_inventory_movements_page(
    db: Session,
    *,
    item_id: UUID | None = None,
    skip: int = 0,
    limit: int = 100,
) -> list[InventoryMovement]:
    return list_inventory_movements(
        db,
        item_id=item_id,
        skip=skip,
        limit=min(limit, 200),
    )


def get_inventory_summary(db: Session) -> InventorySummary:
    total_items = count_inventory_items(db)
    inactive_items = count_inventory_items(db, is_active=False)

    return InventorySummary(
        total_items=total_items,
        low_stock_items=count_low_stock_items(db),
        inactive_items=inactive_items,
        total_stock_value=sum_inventory_value(db),
    )
