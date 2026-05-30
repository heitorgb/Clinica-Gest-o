from fastapi.testclient import TestClient

from app.core.application import create_app
from app.core.config import Settings
from app.modules.mcp.service import get_mcp_tools


def mcp_client(
    *,
    write_tools_enabled: bool = False,
    auth_enabled: bool = False,
    auth_token: str | None = None,
) -> TestClient:
    return TestClient(
        create_app(
            Settings(
                app_env="test",
                mcp_connector_enabled=True,
                mcp_write_tools_enabled=write_tools_enabled,
                mcp_audit_enabled=False,
                mcp_auth_enabled=auth_enabled,
                mcp_auth_token=auth_token,
            )
        )
    )


def test_mcp_initialize_returns_tool_capability() -> None:
    response = mcp_client().post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "initialize",
            "params": {
                "protocolVersion": "2025-06-18",
                "capabilities": {},
                "clientInfo": {"name": "test-client", "version": "1.0.0"},
            },
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["protocolVersion"] == "2025-06-18"
    assert result["capabilities"]["tools"]["listChanged"] is False
    assert result["serverInfo"]["name"] == "clinica-gestao"


def test_mcp_tools_list_exposes_only_read_only_tools_by_default() -> None:
    settings = Settings(mcp_write_tools_enabled=False)
    response = mcp_client().post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 2,
            "method": "tools/list",
            "params": {},
        },
    )

    assert response.status_code == 200
    tools = response.json()["result"]["tools"]
    assert {tool["name"] for tool in tools} == {tool["name"] for tool in get_mcp_tools(settings)}
    assert all(tool["annotations"]["readOnlyHint"] is True for tool in tools)
    assert all(tool["annotations"]["destructiveHint"] is False for tool in tools)


def test_mcp_tools_list_exposes_write_tools_when_enabled() -> None:
    settings = Settings(mcp_write_tools_enabled=True)
    response = mcp_client(write_tools_enabled=True).post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 20,
            "method": "tools/list",
            "params": {},
        },
    )

    assert response.status_code == 200
    tools = response.json()["result"]["tools"]
    tool_names = {tool["name"] for tool in tools}
    assert tool_names == {tool["name"] for tool in get_mcp_tools(settings)}
    assert {
        "create_lead",
        "update_lead_stage",
        "create_receivable",
        "create_payable",
        "mark_financial_transaction_paid",
        "create_inventory_item",
        "register_inventory_movement",
        "create_commission",
        "update_commission_status",
    }.issubset(tool_names)
    assert any(tool["annotations"]["readOnlyHint"] is False for tool in tools)


def test_mcp_write_tool_is_blocked_when_disabled() -> None:
    response = mcp_client().post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 21,
            "method": "tools/call",
            "params": {
                "name": "create_lead",
                "arguments": {
                    "name": "Mariana Lopes",
                    "origin": "Instagram",
                },
            },
        },
    )

    assert response.status_code == 200
    error = response.json()["error"]
    assert error["code"] == -32602
    assert error["message"] == "Unknown tool: create_lead"


def test_mcp_write_tool_validation_returns_tool_error_when_enabled() -> None:
    response = mcp_client(write_tools_enabled=True).post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 22,
            "method": "tools/call",
            "params": {
                "name": "create_receivable",
                "arguments": {
                    "description": "Parcela pacote estetico",
                    "category": "Receita",
                    "amount": 1500,
                },
            },
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["isError"] is True
    assert "due_date" in result["content"][0]["text"]


def test_mcp_unknown_tool_returns_protocol_error() -> None:
    response = mcp_client().post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 3,
            "method": "tools/call",
            "params": {
                "name": "delete_everything",
                "arguments": {},
            },
        },
    )

    assert response.status_code == 200
    error = response.json()["error"]
    assert error["code"] == -32602
    assert error["message"] == "Unknown tool: delete_everything"


def test_mcp_notifications_return_accepted() -> None:
    response = mcp_client().post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "method": "notifications/initialized",
        },
    )

    assert response.status_code == 202
    assert response.content == b""


def test_mcp_auth_rejects_missing_token_when_enabled() -> None:
    response = mcp_client(auth_enabled=True, auth_token="secret-token").post(
        "/mcp",
        json={
            "jsonrpc": "2.0",
            "id": 30,
            "method": "tools/list",
            "params": {},
        },
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid MCP token."


def test_mcp_auth_accepts_bearer_token_when_enabled() -> None:
    response = mcp_client(auth_enabled=True, auth_token="secret-token").post(
        "/mcp",
        headers={"Authorization": "Bearer secret-token"},
        json={
            "jsonrpc": "2.0",
            "id": 31,
            "method": "tools/list",
            "params": {},
        },
    )

    assert response.status_code == 200
    assert "tools" in response.json()["result"]


def test_mcp_auth_accepts_query_token_when_enabled() -> None:
    response = mcp_client(auth_enabled=True, auth_token="secret-token").post(
        "/mcp?token=secret-token",
        json={
            "jsonrpc": "2.0",
            "id": 32,
            "method": "tools/list",
            "params": {},
        },
    )

    assert response.status_code == 200
    assert "tools" in response.json()["result"]
