from decimal import Decimal
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.modules.crm.models import LEAD_STAGES, Lead
from app.modules.crm.repository import get_lead_by_id, list_leads, summarize_pipeline
from app.modules.crm.schemas import LeadCreate, LeadUpdate, PipelineStageSummary
from app.modules.users.repository import get_user_by_id


def get_lead_or_404(db: Session, lead_id: UUID) -> Lead:
    lead = get_lead_by_id(db, lead_id)
    if lead is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead nao encontrado",
        )
    return lead


def ensure_owner_exists(db: Session, owner_id: UUID | None) -> None:
    if owner_id is None:
        return

    owner = get_user_by_id(db, owner_id)
    if owner is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Responsavel inexistente",
        )

    if not owner.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Responsavel inativo",
        )


def create_lead(db: Session, payload: LeadCreate) -> Lead:
    ensure_owner_exists(db, payload.owner_id)

    lead = Lead(**payload.model_dump())
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def update_lead(db: Session, lead: Lead, payload: LeadUpdate) -> Lead:
    data = payload.model_dump(exclude_unset=True)

    if "owner_id" in data:
        ensure_owner_exists(db, data["owner_id"])

    for field, value in data.items():
        setattr(lead, field, value)

    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


def list_leads_page(
    db: Session,
    *,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    stage: str | None = None,
    status: str | None = None,
    owner_id: UUID | None = None,
) -> list[Lead]:
    return list_leads(
        db,
        skip=skip,
        limit=min(limit, 200),
        search=search,
        stage=stage,
        status=status,
        owner_id=owner_id,
    )


def get_pipeline_summary(db: Session) -> list[PipelineStageSummary]:
    rows = {stage: (count, value) for stage, count, value in summarize_pipeline(db)}

    return [
        PipelineStageSummary(
            stage=stage,
            leads_count=rows.get(stage, (0, Decimal("0.00")))[0],
            estimated_value=rows.get(stage, (0, Decimal("0.00")))[1],
        )
        for stage in LEAD_STAGES
    ]
