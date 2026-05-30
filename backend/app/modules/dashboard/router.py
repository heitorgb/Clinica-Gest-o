from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.dashboard.schemas import DashboardSummary
from app.modules.dashboard.service import get_dashboard_summary
from app.modules.users.models import User

router = APIRouter(prefix="/dashboard")
require_dashboard_access = require_permission("dashboard:read")


@router.get("/summary", response_model=DashboardSummary, summary="Resume indicadores gerenciais")
def get_dashboard_summary_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_dashboard_access)],
) -> DashboardSummary:
    return get_dashboard_summary(db)
