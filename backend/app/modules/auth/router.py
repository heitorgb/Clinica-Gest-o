from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_user
from app.modules.auth.schemas import LoginRequest, RefreshTokenRequest, TokenPair
from app.modules.auth.service import authenticate_user, build_token_pair, refresh_user_tokens
from app.modules.users.models import User
from app.modules.users.schemas import UserPublic

router = APIRouter(prefix="/auth")


@router.post("/login", response_model=TokenPair, summary="Autentica um usuario")
def login(payload: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenPair:
    user = authenticate_user(db, payload.email, payload.password)
    return build_token_pair(user)


@router.post("/refresh", response_model=TokenPair, summary="Renova tokens de acesso")
def refresh(payload: RefreshTokenRequest, db: Annotated[Session, Depends(get_db)]) -> TokenPair:
    return refresh_user_tokens(db, payload.refresh_token)


@router.get("/me", response_model=UserPublic, summary="Retorna o usuario autenticado")
def me(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    return current_user
