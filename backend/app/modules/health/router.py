from datetime import UTC, datetime

from fastapi import APIRouter

from app.core.config import get_settings

router = APIRouter()


@router.get("/health", summary="Verifica se a API esta respondendo")
def health_check() -> dict[str, str]:
    settings = get_settings()

    return {
        "status": "ok",
        "service": settings.app_name,
        "environment": settings.app_env,
        "timestamp": datetime.now(UTC).isoformat(),
    }
