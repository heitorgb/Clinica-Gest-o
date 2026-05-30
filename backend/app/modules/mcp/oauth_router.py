from typing import Annotated, Any

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.db.session import get_db
from app.modules.mcp.oauth import (
    authorization_form,
    authorization_server_metadata,
    authorize_with_credentials,
    create_oauth_client,
    exchange_token,
    parse_urlencoded_form,
    protected_resource_metadata,
)

router = APIRouter(tags=["mcp-oauth"])


@router.get("/.well-known/oauth-protected-resource")
def oauth_protected_resource_root(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    return protected_resource_metadata(request, settings)


@router.get("/.well-known/oauth-protected-resource/mcp")
def oauth_protected_resource_mcp(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    return protected_resource_metadata(request, settings)


@router.get("/.well-known/oauth-authorization-server")
def oauth_authorization_server(
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    return authorization_server_metadata(request, settings)


@router.post("/oauth/register", status_code=201)
async def oauth_register(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    payload = await request.json()
    return create_oauth_client(db, payload if isinstance(payload, dict) else {})


@router.get("/oauth/authorize")
def oauth_authorize_form(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    return authorization_form(db, dict(request.query_params))


@router.post("/oauth/authorize")
async def oauth_authorize_submit(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
):
    form = await parse_urlencoded_form(request)
    return authorize_with_credentials(db, form)


@router.post("/oauth/token")
async def oauth_token(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> dict[str, Any]:
    form = await parse_urlencoded_form(request)
    return exchange_token(db, settings, form)
