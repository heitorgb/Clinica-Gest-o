from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.crm.models import Lead
from app.modules.crm.schemas import (
    LeadCreate,
    LeadPublic,
    LeadStage,
    LeadStatus,
    LeadUpdate,
    PipelineStageSummary,
)
from app.modules.crm.service import (
    create_lead,
    get_lead_or_404,
    get_pipeline_summary,
    list_leads_page,
    update_lead,
)
from app.modules.users.models import User

router = APIRouter(prefix="/crm")
require_crm_access = require_permission("crm:manage")


@router.get("/pipeline", response_model=list[PipelineStageSummary], summary="Resume o funil")
def get_pipeline_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_crm_access)],
) -> list[PipelineStageSummary]:
    return get_pipeline_summary(db)


@router.get("/leads", response_model=list[LeadPublic], summary="Lista leads")
def list_leads_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_crm_access)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    search: Annotated[str | None, Query(max_length=120)] = None,
    stage: LeadStage | None = None,
    status: LeadStatus | None = None,
    owner_id: UUID | None = None,
) -> list[Lead]:
    return list_leads_page(
        db,
        skip=skip,
        limit=limit,
        search=search,
        stage=stage,
        status=status,
        owner_id=owner_id,
    )


@router.post("/leads", response_model=LeadPublic, status_code=201, summary="Cria lead")
def create_lead_endpoint(
    payload: LeadCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_crm_access)],
) -> Lead:
    return create_lead(db, payload)


@router.get("/leads/{lead_id}", response_model=LeadPublic, summary="Busca lead")
def get_lead_endpoint(
    lead_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_crm_access)],
) -> Lead:
    return get_lead_or_404(db, lead_id)


@router.patch("/leads/{lead_id}", response_model=LeadPublic, summary="Atualiza lead")
def update_lead_endpoint(
    lead_id: UUID,
    payload: LeadUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_crm_access)],
) -> Lead:
    lead = get_lead_or_404(db, lead_id)
    return update_lead(db, lead, payload)
