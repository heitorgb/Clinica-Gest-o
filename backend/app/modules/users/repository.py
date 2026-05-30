from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.modules.users.models import Permission, Role, User


def normalize_email(email: str) -> str:
    return email.strip().lower()


def normalize_name(name: str) -> str:
    return name.strip().lower()


def get_user_by_id(db: Session, user_id: UUID) -> User | None:
    statement = (
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return db.execute(statement).scalar_one_or_none()


def get_user_by_email(db: Session, email: str) -> User | None:
    statement = (
        select(User)
        .where(User.email == normalize_email(email))
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    return db.execute(statement).scalar_one_or_none()


def list_users(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    statement = (
        select(User)
        .options(selectinload(User.roles).selectinload(Role.permissions))
        .order_by(User.name)
        .offset(skip)
        .limit(limit)
    )
    return list(db.execute(statement).scalars().all())


def get_role_by_name(db: Session, name: str) -> Role | None:
    statement = (
        select(Role)
        .where(Role.name == normalize_name(name))
        .options(selectinload(Role.permissions))
    )
    return db.execute(statement).scalar_one_or_none()


def list_roles(db: Session) -> list[Role]:
    statement = select(Role).options(selectinload(Role.permissions)).order_by(Role.name)
    return list(db.execute(statement).scalars().all())


def get_permission_by_name(db: Session, name: str) -> Permission | None:
    statement = select(Permission).where(Permission.name == normalize_name(name))
    return db.execute(statement).scalar_one_or_none()


def update_last_login(db: Session, user: User) -> User:
    from datetime import UTC, datetime

    user.last_login_at = datetime.now(UTC)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
