from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import get_current_superuser
from app.modules.users.models import Role, User
from app.modules.users.repository import list_roles
from app.modules.users.schemas import RolePublic, UserCreate, UserPublic, UserUpdate
from app.modules.users.service import create_user, get_user_or_404, list_users_page, update_user

router = APIRouter(prefix="/users")


@router.get("", response_model=list[UserPublic], summary="Lista usuarios")
def list_users_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
) -> list[User]:
    return list_users_page(db, skip=skip, limit=limit)


@router.post("", response_model=UserPublic, status_code=201, summary="Cria usuario")
def create_user_endpoint(
    payload: UserCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> User:
    return create_user(db, payload)


@router.get("/roles", response_model=list[RolePublic], summary="Lista papeis")
def list_roles_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> list[Role]:
    return list_roles(db)


@router.get("/{user_id}", response_model=UserPublic, summary="Busca usuario")
def get_user_endpoint(
    user_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> User:
    return get_user_or_404(db, user_id)


@router.patch("/{user_id}", response_model=UserPublic, summary="Atualiza usuario")
def update_user_endpoint(
    user_id: UUID,
    payload: UserUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(get_current_superuser)],
) -> User:
    user = get_user_or_404(db, user_id)
    return update_user(db, user, payload)
