import pytest
from fastapi import HTTPException

from app.modules.users.service import DEFAULT_ROLES, resolve_user_role_names


def role_permissions(role_name: str) -> list[str]:
    permissions = DEFAULT_ROLES[role_name]["permissions"]
    assert isinstance(permissions, list)
    return permissions


def test_resolve_user_role_names_defaults_to_read_only() -> None:
    assert resolve_user_role_names([]) == ["leitura"]


def test_resolve_user_role_names_admin_is_exclusive() -> None:
    assert resolve_user_role_names(["comercial"], is_superuser=True) == ["admin"]


def test_resolve_user_role_names_rejects_multiple_operational_types() -> None:
    with pytest.raises(HTTPException):
        resolve_user_role_names(["comercial", "estoque"])


def test_role_definitions_keep_commercial_and_inventory_separated() -> None:
    assert "inventory:manage" not in role_permissions("comercial")
    assert "crm:manage" not in role_permissions("estoque")
    assert "finance:manage" not in role_permissions("comercial")
    assert "inventory:manage" not in role_permissions("financeiro")
