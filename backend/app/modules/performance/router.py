from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.modules.auth.dependencies import require_permission
from app.modules.performance.models import Commission, PerformanceGoal
from app.modules.performance.schemas import (
    CommissionCreate,
    CommissionPublic,
    CommissionStatus,
    CommissionUpdate,
    GoalMetric,
    GoalStatus,
    PerformanceGoalCreate,
    PerformanceGoalPublic,
    PerformanceGoalUpdate,
    PerformanceSummary,
)
from app.modules.performance.service import (
    create_commission,
    create_performance_goal,
    get_commission_or_404,
    get_performance_goal_or_404,
    get_performance_summary,
    list_commissions_page,
    list_performance_goals_page,
    update_commission,
    update_performance_goal,
)
from app.modules.users.models import User

router = APIRouter(prefix="/performance")
require_performance_access = require_permission("performance:manage")


@router.get("/summary", response_model=PerformanceSummary, summary="Resume metas e comissoes")
def get_performance_summary_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> PerformanceSummary:
    return get_performance_summary(db)


@router.get("/goals", response_model=list[PerformanceGoalPublic], summary="Lista metas")
def list_performance_goals_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    status: GoalStatus | None = None,
    metric: GoalMetric | None = None,
    owner_id: UUID | None = None,
) -> list[PerformanceGoal]:
    return list_performance_goals_page(
        db,
        skip=skip,
        limit=limit,
        status=status,
        metric=metric,
        owner_id=owner_id,
    )


@router.post("/goals", response_model=PerformanceGoalPublic, status_code=201, summary="Cria meta")
def create_performance_goal_endpoint(
    payload: PerformanceGoalCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> PerformanceGoal:
    return create_performance_goal(db, payload)


@router.get("/goals/{goal_id}", response_model=PerformanceGoalPublic, summary="Busca meta")
def get_performance_goal_endpoint(
    goal_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> PerformanceGoal:
    return get_performance_goal_or_404(db, goal_id)


@router.patch("/goals/{goal_id}", response_model=PerformanceGoalPublic, summary="Atualiza meta")
def update_performance_goal_endpoint(
    goal_id: UUID,
    payload: PerformanceGoalUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> PerformanceGoal:
    goal = get_performance_goal_or_404(db, goal_id)
    return update_performance_goal(db, goal, payload)


@router.get("/commissions", response_model=list[CommissionPublic], summary="Lista comissoes")
def list_commissions_endpoint(
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 100,
    status: CommissionStatus | None = None,
    owner_id: UUID | None = None,
) -> list[Commission]:
    return list_commissions_page(
        db,
        skip=skip,
        limit=limit,
        status=status,
        owner_id=owner_id,
    )


@router.post(
    "/commissions",
    response_model=CommissionPublic,
    status_code=201,
    summary="Cria comissao",
)
def create_commission_endpoint(
    payload: CommissionCreate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> Commission:
    return create_commission(db, payload)


@router.get(
    "/commissions/{commission_id}",
    response_model=CommissionPublic,
    summary="Busca comissao",
)
def get_commission_endpoint(
    commission_id: UUID,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> Commission:
    return get_commission_or_404(db, commission_id)


@router.patch(
    "/commissions/{commission_id}",
    response_model=CommissionPublic,
    summary="Atualiza comissao",
)
def update_commission_endpoint(
    commission_id: UUID,
    payload: CommissionUpdate,
    db: Annotated[Session, Depends(get_db)],
    _current_user: Annotated[User, Depends(require_performance_access)],
) -> Commission:
    commission = get_commission_or_404(db, commission_id)
    return update_commission(db, commission, payload)
