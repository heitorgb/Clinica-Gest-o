from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.modules.inventory.models import InventoryItem
from app.modules.inventory.schemas import InventoryItemCreate, InventoryMovementCreate
from app.modules.inventory.service import apply_inventory_movement


def test_inventory_item_create_defaults_and_normalization() -> None:
    item = InventoryItemCreate(
        name="  Luvas nitrilicas P  ",
        sku="  LUV-P  ",
        category="  Descartaveis  ",
        minimum_quantity=Decimal("20.000"),
        cost_price=Decimal("42.50"),
    )

    assert item.name == "Luvas nitrilicas P"
    assert item.sku == "LUV-P"
    assert item.category == "Descartaveis"
    assert item.unit == "un"
    assert item.current_quantity == Decimal("0.000")
    assert item.minimum_quantity == Decimal("20.000")


def test_inventory_movement_rejects_zero_quantity() -> None:
    with pytest.raises(ValidationError):
        InventoryMovementCreate(
            item_id=uuid4(),
            movement_type="in",
            quantity=Decimal("0.000"),
        )


def test_inventory_in_movement_increases_quantity() -> None:
    item = InventoryItem(name="Seringa 5 ml", current_quantity=Decimal("10.000"))
    movement = InventoryMovementCreate(
        item_id=uuid4(),
        movement_type="in",
        quantity=Decimal("5.000"),
    )

    apply_inventory_movement(item, movement)

    assert item.current_quantity == Decimal("15.000")


def test_inventory_out_movement_rejects_negative_stock() -> None:
    item = InventoryItem(name="Soro fisiologico", current_quantity=Decimal("2.000"))
    movement = InventoryMovementCreate(
        item_id=uuid4(),
        movement_type="out",
        quantity=Decimal("3.000"),
    )

    with pytest.raises(HTTPException):
        apply_inventory_movement(item, movement)


def test_inventory_adjustment_sets_current_quantity() -> None:
    item = InventoryItem(name="Anestesico topico", current_quantity=Decimal("2.000"))
    movement = InventoryMovementCreate(
        item_id=uuid4(),
        movement_type="adjustment",
        quantity=Decimal("12.000"),
    )

    apply_inventory_movement(item, movement)

    assert item.current_quantity == Decimal("12.000")
