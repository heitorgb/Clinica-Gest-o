from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.modules.crm.models import Lead


def list_leads(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    stage: str | None = None,
    status: str | None = None,
    owner_id: UUID | None = None,
) -> list[Lead]:
    statement = select(Lead).options(selectinload(Lead.owner)).order_by(Lead.created_at.desc())

    if search:
        pattern = f"%{search.strip()}%"
        statement = statement.where(
            or_(
                Lead.name.ilike(pattern),
                Lead.email.ilike(pattern),
                Lead.phone.ilike(pattern),
            )
        )

    if stage:
        statement = statement.where(Lead.stage == stage)

    if status:
        statement = statement.where(Lead.status == status)

    if owner_id:
        statement = statement.where(Lead.owner_id == owner_id)

    statement = statement.offset(skip).limit(limit)
    return list(db.execute(statement).scalars().all())


def get_lead_by_id(db: Session, lead_id: UUID) -> Lead | None:
    statement = select(Lead).where(Lead.id == lead_id).options(selectinload(Lead.owner))
    return db.execute(statement).scalar_one_or_none()


def summarize_pipeline(db: Session) -> list[tuple[str, int, object]]:
    statement = (
        select(
            Lead.stage,
            func.count(Lead.id),
            func.coalesce(func.sum(Lead.estimated_value), 0),
        )
        .where(Lead.status == "open")
        .group_by(Lead.stage)
    )
    return list(db.execute(statement).all())
