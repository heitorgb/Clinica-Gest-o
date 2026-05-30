from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.modules.auth.schemas import TokenPair
from app.modules.users.models import User
from app.modules.users.repository import get_user_by_email, get_user_by_id, update_last_login


def credentials_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Credenciais invalidas",
        headers={"WWW-Authenticate": "Bearer"},
    )


def inactive_user_exception() -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Usuario inativo",
    )


def build_token_pair(user: User) -> TokenPair:
    subject = str(user.id)
    return TokenPair(
        access_token=create_access_token(subject),
        refresh_token=create_refresh_token(subject),
    )


def authenticate_user(db: Session, email: str, password: str) -> User:
    user = get_user_by_email(db, email)

    if user is None or not verify_password(password, user.hashed_password):
        raise credentials_exception()

    if not user.is_active:
        raise inactive_user_exception()

    return update_last_login(db, user)


def refresh_user_tokens(db: Session, refresh_token: str) -> TokenPair:
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise ValueError("Token nao e refresh")
        user_id = UUID(payload["sub"])
    except (ValueError, TypeError):
        raise credentials_exception() from None

    user = get_user_by_id(db, user_id)

    if user is None:
        raise credentials_exception()

    if not user.is_active:
        raise inactive_user_exception()

    return build_token_pair(user)
