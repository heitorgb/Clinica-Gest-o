from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class PermissionPublic(BaseModel):
    id: UUID
    name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


class RolePublic(BaseModel):
    id: UUID
    name: str
    description: str | None = None
    permissions: list[PermissionPublic] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserPublic(BaseModel):
    id: UUID
    name: str
    email: str
    is_active: bool
    is_superuser: bool
    created_at: datetime
    updated_at: datetime
    last_login_at: datetime | None = None
    roles: list[RolePublic] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    name: str = Field(min_length=2, max_length=160)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role_names: list[str] = Field(default_factory=list)
    is_active: bool = True
    is_superuser: bool = False

    @field_validator("role_names")
    @classmethod
    def normalize_roles(cls, value: list[str]) -> list[str]:
        return sorted({role.strip().lower() for role in value if role.strip()})


class UserUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=160)
    is_active: bool | None = None
    role_names: list[str] | None = None

    @field_validator("role_names")
    @classmethod
    def normalize_roles(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return sorted({role.strip().lower() for role in value if role.strip()})
