from app.core.security import create_access_token, decode_token, hash_password, verify_password
from app.modules.auth.dependencies import user_has_permission


def test_password_hash_and_verify() -> None:
    hashed_password = hash_password("senha-segura-123")

    assert hashed_password != "senha-segura-123"
    assert verify_password("senha-segura-123", hashed_password)
    assert not verify_password("senha-incorreta", hashed_password)


def test_access_token_payload() -> None:
    token = create_access_token("user-id")
    payload = decode_token(token)

    assert payload["sub"] == "user-id"
    assert payload["type"] == "access"


def test_user_permission_helper() -> None:
    class Permission:
        name = "users:read"

    class Role:
        permissions = [Permission()]

    class User:
        is_superuser = False
        roles = [Role()]

    assert user_has_permission(User(), "users:read")
    assert not user_has_permission(User(), "finance:manage")
