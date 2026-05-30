from sqlalchemy.orm import Session

from app.modules.clinic.models import ClinicSettings
from app.modules.clinic.repository import get_clinic_settings
from app.modules.clinic.schemas import ClinicSettingsUpdate


def get_or_create_clinic_settings(db: Session) -> ClinicSettings:
    settings = get_clinic_settings(db)

    if settings is not None:
        return settings

    settings = ClinicSettings(
        name="Clinica",
        timezone="America/Sao_Paulo",
        currency="BRL",
    )
    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings


def update_clinic_settings(
    db: Session,
    payload: ClinicSettingsUpdate,
) -> ClinicSettings:
    settings = get_or_create_clinic_settings(db)
    data = payload.model_dump(exclude_unset=True)

    for field, value in data.items():
        setattr(settings, field, value)

    db.add(settings)
    db.commit()
    db.refresh(settings)
    return settings
