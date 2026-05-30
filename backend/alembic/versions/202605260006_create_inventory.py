"""create inventory

Revision ID: 202605260006
Revises: 202605260005
Create Date: 2026-05-26 00:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "202605260006"
down_revision: str | None = "202605260005"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "inventory_items",
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("sku", sa.String(length=80), nullable=True),
        sa.Column("category", sa.String(length=80), nullable=True),
        sa.Column("unit", sa.String(length=24), server_default="un", nullable=False),
        sa.Column("current_quantity", sa.Numeric(12, 3), server_default="0", nullable=False),
        sa.Column("minimum_quantity", sa.Numeric(12, 3), server_default="0", nullable=False),
        sa.Column("cost_price", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("supplier", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "cost_price >= 0",
            name=op.f("ck_inventory_items_inventory_item_cost_price_valid"),
        ),
        sa.CheckConstraint(
            "current_quantity >= 0",
            name=op.f("ck_inventory_items_inventory_item_current_quantity_valid"),
        ),
        sa.CheckConstraint(
            "minimum_quantity >= 0",
            name=op.f("ck_inventory_items_inventory_item_minimum_quantity_valid"),
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_items")),
        sa.UniqueConstraint("sku", name=op.f("uq_inventory_items_sku")),
    )
    op.create_table(
        "inventory_movements",
        sa.Column("item_id", sa.Uuid(), nullable=False),
        sa.Column("movement_type", sa.String(length=20), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 3), nullable=False),
        sa.Column("unit_cost", sa.Numeric(12, 2), server_default="0", nullable=False),
        sa.Column("reason", sa.String(length=160), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "movement_type in ('in', 'out', 'adjustment')",
            name=op.f("ck_inventory_movements_inventory_movement_type_valid"),
        ),
        sa.CheckConstraint(
            "quantity > 0",
            name=op.f("ck_inventory_movements_inventory_movement_quantity_valid"),
        ),
        sa.CheckConstraint(
            "unit_cost >= 0",
            name=op.f("ck_inventory_movements_inventory_movement_unit_cost_valid"),
        ),
        sa.ForeignKeyConstraint(
            ["item_id"],
            ["inventory_items.id"],
            name=op.f("fk_inventory_movements_item_id_inventory_items"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_inventory_movements")),
    )
    op.create_index(
        op.f("ix_inventory_items_category"),
        "inventory_items",
        ["category"],
        unique=False,
    )
    op.create_index(op.f("ix_inventory_items_name"), "inventory_items", ["name"], unique=False)
    op.create_index(
        op.f("ix_inventory_movements_item_id"),
        "inventory_movements",
        ["item_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_inventory_movements_occurred_at"),
        "inventory_movements",
        ["occurred_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_inventory_movements_occurred_at"), table_name="inventory_movements")
    op.drop_index(op.f("ix_inventory_movements_item_id"), table_name="inventory_movements")
    op.drop_index(op.f("ix_inventory_items_name"), table_name="inventory_items")
    op.drop_index(op.f("ix_inventory_items_category"), table_name="inventory_items")
    op.drop_table("inventory_movements")
    op.drop_table("inventory_items")
