from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.clinic.models import ClinicSettings
from app.modules.clinic.schemas import ClinicSettingsPublic, ClinicSettingsUpdate
from app.modules.clinic.service import get_or_create_clinic_settings, update_clinic_settings
from app.modules.users.models import User

router = APIRouter(prefix="/clinic")
require_clinic_access = require_permission("clinic:manage")


@router.get(
    "/settings",
    response_model=ClinicSettingsPublic,
    summary="Busca configuracoes da clinica",
)
def get_clinic_settings_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_clinic_access)],
) -> ClinicSettings:
    return get_or_create_clinic_settings(db)


@router.patch(
    "/settings",
    response_model=ClinicSettingsPublic,
    summary="Atualiza configuracoes da clinica",
)
def update_clinic_settings_endpoint(
    payload: ClinicSettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_clinic_access)],
) -> ClinicSettings:
    return update_clinic_settings(db, payload)
