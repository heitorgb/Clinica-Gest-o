from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.modules.auth.service import credentials_exception, inactive_user_exception
from app.modules.users.models import User
from app.modules.users.repository import get_user_by_id

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise credentials_exception()

    try:
        payload = decode_token(credentials.credentials)
        if payload.get("type") != "access":
            raise ValueError("Token nao e access")
        user_id = UUID(payload["sub"])
    except (ValueError, TypeError):
        raise credentials_exception() from None

    user = get_user_by_id(db, user_id)

    if user is None:
        raise credentials_exception()

    if not user.is_active:
        raise inactive_user_exception()

    return user


def user_has_permission(user: User, permission_name: str) -> bool:
    if user.is_superuser:
        return True

    return any(
        permission.name == permission_name
        for role in user.roles
        for permission in role.permissions
    )


def get_current_superuser(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    if not current_user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acesso restrito a administradores",
        )
    return current_user


def require_permission(permission_name: str):
    def dependency(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if not user_has_permission(current_user, permission_name):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Permissao insuficiente",
            )
        return current_user

    return dependency
