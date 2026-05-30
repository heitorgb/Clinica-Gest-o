from fastapi import APIRouter

from app.modules.auth.router import router as auth_router
from app.modules.clinic.router import router as clinic_router
from app.modules.crm.router import router as crm_router
from app.modules.dashboard.router import router as dashboard_router
from app.modules.finance.router import router as finance_router
from app.modules.health.router import router as health_router
from app.modules.integrations.router import router as integrations_router
from app.modules.inventory.router import router as inventory_router
from app.modules.performance.router import router as performance_router
from app.modules.users.router import router as users_router

api_router = APIRouter()
api_router.include_router(auth_router, tags=["auth"])
api_router.include_router(clinic_router, tags=["clinic"])
api_router.include_router(crm_router, tags=["crm"])
api_router.include_router(dashboard_router, tags=["dashboard"])
api_router.include_router(finance_router, tags=["finance"])
api_router.include_router(health_router, tags=["health"])
api_router.include_router(integrations_router, tags=["integrations"])
api_router.include_router(inventory_router, tags=["inventory"])
api_router.include_router(performance_router, tags=["performance"])
api_router.include_router(users_router, tags=["users"])
