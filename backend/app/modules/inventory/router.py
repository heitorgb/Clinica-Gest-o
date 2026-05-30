from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.inventory.models import InventoryItem, InventoryMovement
from app.modules.inventory.schemas import (
    InventoryItemCreate,
    InventoryItemPublic,
    InventoryItemUpdate,
    InventoryMovementCreate,
    InventoryMovementPublic,
    InventorySummary,
)
from app.modules.inventory.service import (
    create_inventory_item,
    create_inventory_movement,
    get_inventory_item_or_404,
    get_inventory_summary,
    list_inventory_items_page,
    list_inventory_movements_page,
    update_inventory_item,
)
from app.modules.users.models import User

router = APIRouter(prefix="/inventory")
require_inventory_access = require_permission("inventory:manage")


@router.get("/summary", response_model=InventorySummary, summary="Resume o estoque")
def get_inventory_summary_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
) -> InventorySummary:
    return get_inventory_summary(db)


@router.get("/items", response_model=list[InventoryItemPublic], summary="Lista itens")
def list_inventory_items_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    search: Annotated[str | None, Query(max_length=120)] = None,
    category: Annotated[str | None, Query(max_length=80)] = None,
    low_stock: bool | None = None,
    is_active: bool | None = None,
) -> list[InventoryItem]:
    return list_inventory_items_page(
        db,
        skip=skip,
        limit=limit,
        search=search,
        category=category,
        low_stock=low_stock,
        is_active=is_active,
    )


@router.post("/items", response_model=InventoryItemPublic, status_code=201, summary="Cria item")
def create_inventory_item_endpoint(
    payload: InventoryItemCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
) -> InventoryItem:
    return create_inventory_item(db, payload)


@router.get("/items/{item_id}", response_model=InventoryItemPublic, summary="Busca item")
def get_inventory_item_endpoint(
    item_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
) -> InventoryItem:
    return get_inventory_item_or_404(db, item_id)


@router.patch("/items/{item_id}", response_model=InventoryItemPublic, summary="Atualiza item")
def update_inventory_item_endpoint(
    item_id: UUID,
    payload: InventoryItemUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
) -> InventoryItem:
    item = get_inventory_item_or_404(db, item_id)
    return update_inventory_item(db, item, payload)


@router.get(
    "/movements",
    response_model=list[InventoryMovementPublic],
    summary="Lista movimentacoes",
)
def list_inventory_movements_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
    item_id: UUID | None = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[InventoryMovement]:
    return list_inventory_movements_page(
        db,
        item_id=item_id,
        skip=skip,
        limit=limit,
    )


@router.post(
    "/movements",
    response_model=InventoryMovementPublic,
    status_code=201,
    summary="Cria movimentacao",
)
def create_inventory_movement_endpoint(
    payload: InventoryMovementCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_inventory_access)],
) -> InventoryMovement:
    return create_inventory_movement(db, payload)
