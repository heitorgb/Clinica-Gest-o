from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.clinic.models import ClinicSettings


def get_clinic_settings(db: Session) -> ClinicSettings | None:
    statement = select(ClinicSettings).order_by(ClinicSettings.created_at).limit(1)
    return db.execute(statement).scalar_one_or_none()
