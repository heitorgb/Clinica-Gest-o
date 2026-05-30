from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.mcp.service import (
    handle_mcp_request,
    is_mcp_request_authorized,
    record_mcp_auth_failure,
)

router = APIRouter(tags=["mcp"])


@router.post("/mcp", response_model=None, summary="Remote MCP connector endpoint")
async def mcp_endpoint(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    if not settings.mcp_connector_enabled:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="MCP connector disabled.",
        )

    remote_addr = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")

    if settings.mcp_auth_enabled and not settings.mcp_auth_token:
        record_mcp_auth_failure(
            db,
            settings,
            reason="MCP auth enabled without token.",
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="MCP authentication is not configured.",
        )

    if not is_mcp_request_authorized(
        settings,
        authorization=request.headers.get("authorization"),
        header_token=request.headers.get("x-mcp-token"),
        query_token=request.query_params.get("token"),
    ):
        record_mcp_auth_failure(
            db,
            settings,
            reason="Invalid MCP token.",
            remote_addr=remote_addr,
            user_agent=user_agent,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid MCP token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        payload: Any = await request.json()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON.",
        ) from exc

    if not isinstance(payload, dict):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="JSON-RPC payload must be an object.",
        )

    result = handle_mcp_request(
        payload,
        db,
        settings,
        remote_addr=remote_addr,
        user_agent=user_agent,
    )

    if result is None:
        return Response(status_code=status.HTTP_202_ACCEPTED)

    return JSONResponse(content=result)


@router.get("/mcp", summary="Remote MCP connector SSE stream")
def mcp_stream_unavailable() -> Response:
    return Response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)


@router.delete("/mcp", summary="Remote MCP session termination")
def mcp_delete_unavailable() -> Response:
    return Response(status_code=status.HTTP_405_METHOD_NOT_ALLOWED)
