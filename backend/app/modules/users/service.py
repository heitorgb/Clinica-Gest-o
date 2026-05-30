from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.security import hash_password
from app.modules.users.models import Permission, Role, User
from app.modules.users.repository import (
    get_permission_by_name,
    get_role_by_name,
    get_user_by_email,
    get_user_by_id,
    list_users,
    normalize_email,
    normalize_name,
)
from app.modules.users.schemas import UserCreate, UserUpdate

DEFAULT_PERMISSIONS: dict[str, str] = {
    "users:read": "Visualizar usuarios",
    "users:create": "Criar usuarios",
    "users:update": "Editar usuarios",
    "roles:read": "Visualizar papeis e permissoes",
    "clinic:manage": "Gerenciar configuracoes da clinica",
    "crm:manage": "Gerenciar CRM",
    "finance:manage": "Gerenciar financeiro",
    "inventory:manage": "Gerenciar estoque",
    "dashboard:read": "Visualizar dashboard",
    "performance:manage": "Gerenciar metas e comissoes",
    "integrations:manage": "Gerenciar integracoes",
}

DEFAULT_ROLES: dict[str, dict[str, str | list[str]]] = {
    "admin": {
        "description": "Acesso administrativo completo",
        "permissions": list(DEFAULT_PERMISSIONS.keys()),
    },
    "gestor": {
        "description": "Gestao geral e indicadores",
        "permissions": [
            "clinic:manage",
            "dashboard:read",
            "performance:manage",
            "integrations:manage",
        ],
    },
    "comercial": {
        "description": "Operacao comercial e CRM",
        "permissions": ["crm:manage", "dashboard:read", "performance:manage"],
    },
    "financeiro": {
        "description": "Operacao financeira",
        "permissions": ["finance:manage", "dashboard:read"],
    },
    "estoque": {
        "description": "Operacao de estoque",
        "permissions": ["inventory:manage", "dashboard:read"],
    },
    "leitura": {
        "description": "Acesso somente leitura",
        "permissions": ["dashboard:read"],
    },
}

ADMIN_ROLE = "admin"
DEFAULT_USER_ROLE = "leitura"


def ensure_default_roles_and_permissions(db: Session) -> None:
    permissions_by_name: dict[str, Permission] = {}

    for name, description in DEFAULT_PERMISSIONS.items():
        permission = get_permission_by_name(db, name)
        if permission is None:
            permission = Permission(name=name, description=description)
            db.add(permission)
            db.flush()
        else:
            permission.description = description
        permissions_by_name[name] = permission

    for name, payload in DEFAULT_ROLES.items():
        role = get_role_by_name(db, name)
        if role is None:
            role = Role(name=name, description=str(payload["description"]))
            db.add(role)
            db.flush()
        else:
            role.description = str(payload["description"])

        permission_names = payload["permissions"]
        if not isinstance(permission_names, list):
            permission_names = []
        role.permissions = [permissions_by_name[permission] for permission in permission_names]

    db.commit()


def resolve_user_role_names(role_names: list[str], is_superuser: bool = False) -> list[str]:
    if is_superuser:
        return [ADMIN_ROLE]

    normalized_roles = sorted({normalize_name(role) for role in role_names if role.strip()})

    if not normalized_roles:
        return [DEFAULT_USER_ROLE]

    if ADMIN_ROLE in normalized_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Perfil admin exige usuario administrador",
        )

    if len(normalized_roles) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Escolha apenas um tipo de usuario",
        )

    return normalized_roles


def get_roles_by_names(db: Session, role_names: list[str]) -> list[Role]:
    roles: list[Role] = []

    for role_name in role_names:
        role = get_role_by_name(db, role_name)
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Papel inexistente: {role_name}",
            )
        roles.append(role)

    return roles


def create_user(db: Session, payload: UserCreate) -> User:
    ensure_default_roles_and_permissions(db)

    if get_user_by_email(db, str(payload.email)) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail ja cadastrado",
        )

    role_names = resolve_user_role_names(payload.role_names, payload.is_superuser)

    user = User(
        name=payload.name.strip(),
        email=normalize_email(str(payload.email)),
        hashed_password=hash_password(payload.password),
        is_active=payload.is_active,
        is_superuser=payload.is_superuser,
        roles=get_roles_by_names(db, role_names),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def create_initial_superuser(db: Session, name: str, email: str, password: str) -> User:
    ensure_default_roles_and_permissions(db)

    existing_user = get_user_by_email(db, email)
    if existing_user is not None:
        return existing_user

    payload = UserCreate(
        name=name,
        email=normalize_email(email),
        password=password,
        role_names=["admin"],
        is_active=True,
        is_superuser=True,
    )
    return create_user(db, payload)


def get_user_or_404(db: Session, user_id: UUID) -> User:
    user = get_user_by_id(db, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario nao encontrado",
        )
    return user


def list_users_page(db: Session, skip: int = 0, limit: int = 100) -> list[User]:
    return list_users(db, skip=skip, limit=min(limit, 200))


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
    if payload.name is not None:
        user.name = payload.name.strip()

    if payload.is_active is not None:
        user.is_active = payload.is_active

    if payload.role_names is not None:
        wants_admin = ADMIN_ROLE in {normalize_name(role) for role in payload.role_names}
        role_names = resolve_user_role_names(payload.role_names, wants_admin)
        user.roles = get_roles_by_names(db, role_names)
        user.is_superuser = wants_admin

    db.add(user)
    db.commit()
    db.refresh(user)
    return user
