import base64
import hashlib
import html
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any
from urllib.parse import parse_qs, urlencode
from uuid import UUID

from fastapi import HTTPException, Request, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.security import create_token, decode_token
from app.modules.auth.service import authenticate_user
from app.modules.mcp.models import (
    McpOAuthAuthorizationCode,
    McpOAuthClient,
    McpOAuthRefreshToken,
)

MCP_OAUTH_SCOPES = "mcp:read mcp:write"
CLAUDE_CALLBACK_URL = "https://claude.ai/api/mcp/auth_callback"


def now_utc() -> datetime:
    return datetime.now(UTC)


def random_token(byte_count: int = 32) -> str:
    return secrets.token_urlsafe(byte_count)


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def external_base_url(request: Request, settings: Settings) -> str:
    if settings.public_app_url:
        return settings.public_app_url.rstrip("/")

    proto = request.headers.get("x-forwarded-proto") or request.url.scheme
    host = request.headers.get("x-forwarded-host") or request.headers.get("host")
    if host:
        return f"{proto}://{host}".rstrip("/")

    return str(request.base_url).rstrip("/")


def mcp_resource_url(request: Request, settings: Settings) -> str:
    return f"{external_base_url(request, settings)}/mcp"


def protected_resource_metadata(request: Request, settings: Settings) -> dict[str, Any]:
    base_url = external_base_url(request, settings)
    return {
        "resource": mcp_resource_url(request, settings),
        "authorization_servers": [base_url],
        "scopes_supported": ["mcp:read", "mcp:write"],
        "bearer_methods_supported": ["header"],
    }


def authorization_server_metadata(request: Request, settings: Settings) -> dict[str, Any]:
    base_url = external_base_url(request, settings)
    return {
        "issuer": base_url,
        "authorization_endpoint": f"{base_url}/oauth/authorize",
        "token_endpoint": f"{base_url}/oauth/token",
        "registration_endpoint": f"{base_url}/oauth/register",
        "response_types_supported": ["code"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none"],
        "scopes_supported": ["mcp:read", "mcp:write"],
    }


def create_oauth_client(db: Session, payload: dict[str, Any]) -> dict[str, Any]:
    redirect_uris = payload.get("redirect_uris")
    if not isinstance(redirect_uris, list) or not redirect_uris:
        redirect_uris = [CLAUDE_CALLBACK_URL]

    redirect_uris = [str(uri) for uri in redirect_uris if isinstance(uri, str) and uri.strip()]
    if not redirect_uris:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uris obrigatorio.",
        )

    client = McpOAuthClient(
        client_id=f"clinica_{random_token(24)}",
        client_name=str(payload.get("client_name") or "Claude"),
        redirect_uris=redirect_uris,
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
        token_endpoint_auth_method="none",
    )
    db.add(client)
    db.commit()
    db.refresh(client)

    return {
        "client_id": client.client_id,
        "client_name": client.client_name,
        "redirect_uris": client.redirect_uris,
        "grant_types": client.grant_types,
        "response_types": client.response_types,
        "token_endpoint_auth_method": client.token_endpoint_auth_method,
        "client_id_issued_at": int(client.created_at.timestamp()),
    }


def get_client_or_400(db: Session, client_id: str) -> McpOAuthClient:
    client = db.execute(
        select(McpOAuthClient).where(McpOAuthClient.client_id == client_id)
    ).scalar_one_or_none()
    if client is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="client_id invalido.")
    return client


def validate_authorize_params(db: Session, params: dict[str, str]) -> McpOAuthClient:
    if params.get("response_type") != "code":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="response_type invalido.",
        )

    client = get_client_or_400(db, params.get("client_id", ""))
    redirect_uri = params.get("redirect_uri", "")
    if redirect_uri not in client.redirect_uris:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="redirect_uri invalido.",
        )

    if params.get("code_challenge_method") != "S256" or not params.get("code_challenge"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PKCE S256 obrigatorio.",
        )

    return client


def authorization_form(db: Session, params: dict[str, str]) -> HTMLResponse:
    client = validate_authorize_params(db, params)
    hidden_inputs = "\n".join(
        f'<input type="hidden" name="{html.escape(key)}" value="{html.escape(value)}" />'
        for key, value in params.items()
    )
    client_name = html.escape(client.client_name or "Claude")

    return HTMLResponse(
        f"""<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Conectar MCP</title>
    <style>
      body {{
        background: #111827;
        color: #e5eefb;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }}
      main {{
        width: min(440px, calc(100vw - 32px));
        border: 1px solid #334155;
        border-radius: 12px;
        background: #1f2937;
        padding: 24px;
        box-shadow: 0 24px 80px rgba(0, 0, 0, 0.32);
      }}
      label {{ display: block; margin-top: 16px; font-size: 14px; color: #cbd5e1; }}
      input {{
        box-sizing: border-box;
        width: 100%;
        height: 42px;
        margin-top: 8px;
        border: 1px solid #475569;
        border-radius: 8px;
        background: #111827;
        color: #f8fafc;
        padding: 0 12px;
      }}
      button {{
        width: 100%;
        height: 42px;
        margin-top: 20px;
        border: 0;
        border-radius: 8px;
        background: #059669;
        color: white;
        font-weight: 700;
        cursor: pointer;
      }}
      p {{ color: #cbd5e1; line-height: 1.5; }}
    </style>
  </head>
  <body>
    <main>
      <h1>Conectar {client_name}</h1>
      <p>Entre como administrador da clinica para autorizar o conector MCP no Claude.</p>
      <form method="post" action="/oauth/authorize">
        {hidden_inputs}
        <label>
          E-mail
          <input type="email" name="email" autocomplete="email" required />
        </label>
        <label>
          Senha
          <input type="password" name="password" autocomplete="current-password" required />
        </label>
        <button type="submit">Autorizar conector</button>
      </form>
    </main>
  </body>
</html>"""
    )


async def parse_urlencoded_form(request: Request) -> dict[str, str]:
    body = (await request.body()).decode("utf-8")
    parsed = parse_qs(body, keep_blank_values=True)
    return {key: values[-1] if values else "" for key, values in parsed.items()}


def create_authorization_code(
    db: Session,
    params: dict[str, str],
    *,
    user_id: str,
) -> McpOAuthAuthorizationCode:
    code = McpOAuthAuthorizationCode(
        code=random_token(32),
        client_id=params["client_id"],
        user_id=UUID(user_id),
        redirect_uri=params["redirect_uri"],
        code_challenge=params["code_challenge"],
        code_challenge_method=params["code_challenge_method"],
        scope=params.get("scope") or MCP_OAUTH_SCOPES,
        expires_at=now_utc() + timedelta(minutes=5),
    )
    db.add(code)
    db.commit()
    db.refresh(code)
    return code


def authorize_with_credentials(db: Session, params: dict[str, str]) -> RedirectResponse:
    validate_authorize_params(db, params)
    user = authenticate_user(db, params.get("email", ""), params.get("password", ""))
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Apenas administradores podem autorizar o MCP.",
        )

    code = create_authorization_code(db, params, user_id=str(user.id))
    query = {"code": code.code}
    if params.get("state"):
        query["state"] = params["state"]

    separator = "&" if "?" in code.redirect_uri else "?"
    return RedirectResponse(
        f"{code.redirect_uri}{separator}{urlencode(query)}",
        status_code=status.HTTP_302_FOUND,
    )


def pkce_challenge_matches(verifier: str, expected_challenge: str) -> bool:
    digest = hashlib.sha256(verifier.encode("ascii")).digest()
    challenge = base64.urlsafe_b64encode(digest).decode("ascii").rstrip("=")
    return secrets.compare_digest(challenge, expected_challenge)


def create_mcp_access_token(settings: Settings, *, user_id: str, client_id: str, scope: str) -> str:
    token = create_token(
        subject=user_id,
        token_type="mcp_access",
        expires_delta=timedelta(minutes=settings.mcp_oauth_access_token_expire_minutes),
    )
    return token


def create_refresh_token_record(
    db: Session,
    settings: Settings,
    *,
    client_id: str,
    user_id: str,
    scope: str,
) -> str:
    refresh_token = random_token(48)
    record = McpOAuthRefreshToken(
        token_hash=hash_token(refresh_token),
        client_id=client_id,
        user_id=user_id,
        scope=scope,
        expires_at=now_utc() + timedelta(days=settings.mcp_oauth_refresh_token_expire_days),
    )
    db.add(record)
    db.commit()
    return refresh_token


def token_response(
    settings: Settings,
    *,
    access_token: str,
    refresh_token: str | None,
    scope: str,
) -> dict[str, Any]:
    response: dict[str, Any] = {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": settings.mcp_oauth_access_token_expire_minutes * 60,
        "scope": scope,
    }
    if refresh_token:
        response["refresh_token"] = refresh_token
    return response


def exchange_authorization_code(
    db: Session,
    settings: Settings,
    form: dict[str, str],
) -> dict[str, Any]:
    code = db.execute(
        select(McpOAuthAuthorizationCode).where(
            McpOAuthAuthorizationCode.code == form.get("code", "")
        )
    ).scalar_one_or_none()
    if code is None or code.consumed_at is not None or code.expires_at < now_utc():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code invalido.")

    if form.get("client_id") != code.client_id or form.get("redirect_uri") != code.redirect_uri:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="code invalido.")

    if not pkce_challenge_matches(form.get("code_verifier", ""), code.code_challenge):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="PKCE invalido.")

    code.consumed_at = now_utc()
    db.add(code)
    db.commit()

    user_id = str(code.user_id)
    access_token = create_mcp_access_token(
        settings,
        user_id=user_id,
        client_id=code.client_id,
        scope=code.scope,
    )
    refresh_token = create_refresh_token_record(
        db,
        settings,
        client_id=code.client_id,
        user_id=user_id,
        scope=code.scope,
    )
    return token_response(
        settings,
        access_token=access_token,
        refresh_token=refresh_token,
        scope=code.scope,
    )


def exchange_refresh_token(
    db: Session,
    settings: Settings,
    form: dict[str, str],
) -> dict[str, Any]:
    token_hash = hash_token(form.get("refresh_token", ""))
    record = db.execute(
        select(McpOAuthRefreshToken).where(McpOAuthRefreshToken.token_hash == token_hash)
    ).scalar_one_or_none()

    if (
        record is None
        or record.revoked_at is not None
        or record.expires_at < now_utc()
        or form.get("client_id") != record.client_id
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="refresh_token invalido.",
        )

    record.revoked_at = now_utc()
    db.add(record)
    db.commit()

    user_id = str(record.user_id)
    access_token = create_mcp_access_token(
        settings,
        user_id=user_id,
        client_id=record.client_id,
        scope=record.scope,
    )
    refresh_token = create_refresh_token_record(
        db,
        settings,
        client_id=record.client_id,
        user_id=user_id,
        scope=record.scope,
    )
    return token_response(
        settings,
        access_token=access_token,
        refresh_token=refresh_token,
        scope=record.scope,
    )


def exchange_token(db: Session, settings: Settings, form: dict[str, str]) -> dict[str, Any]:
    grant_type = form.get("grant_type")
    if grant_type == "authorization_code":
        return exchange_authorization_code(db, settings, form)
    if grant_type == "refresh_token":
        return exchange_refresh_token(db, settings, form)
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="grant_type invalido.")


def is_valid_mcp_oauth_token(token: str | None) -> bool:
    if not token:
        return False

    try:
        payload = decode_token(token)
    except ValueError:
        return False

    return payload.get("type") == "mcp_access"
