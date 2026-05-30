import json
import secrets
import time
from datetime import date
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.modules.crm.models import LEAD_STAGES
from app.modules.crm.schemas import LeadCreate, LeadUpdate
from app.modules.crm.service import create_lead, get_lead_or_404, list_leads_page, update_lead
from app.modules.dashboard.service import get_dashboard_summary
from app.modules.finance.schemas import FinancialTransactionCreate, FinancialTransactionUpdate
from app.modules.finance.service import (
    create_financial_transaction,
    get_financial_transaction_or_404,
    list_financial_transactions_page,
    update_financial_transaction,
)
from app.modules.inventory.schemas import InventoryItemCreate, InventoryMovementCreate
from app.modules.inventory.service import (
    create_inventory_item,
    create_inventory_movement,
    list_inventory_items_page,
)
from app.modules.mcp.models import McpAuditLog
from app.modules.mcp.oauth import is_valid_mcp_oauth_token
from app.modules.mcp.repository import create_mcp_audit_log
from app.modules.performance.schemas import CommissionCreate, CommissionUpdate
from app.modules.performance.service import (
    create_commission,
    get_commission_or_404,
    update_commission,
)

MCP_PROTOCOL_VERSION = "2025-06-18"
MCP_SERVER_VERSION = "0.1.0"


def read_only_annotations() -> dict[str, bool]:
    return {
        "readOnlyHint": True,
        "destructiveHint": False,
        "idempotentHint": True,
        "openWorldHint": False,
    }


def action_annotations() -> dict[str, bool]:
    return {
        "readOnlyHint": False,
        "destructiveHint": False,
        "idempotentHint": False,
        "openWorldHint": False,
    }


def empty_input_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "properties": {},
        "additionalProperties": False,
    }


def get_read_tools() -> list[dict[str, Any]]:
    return [
        {
            "name": "get_dashboard_summary",
            "title": "Resumo gerencial",
            "description": (
                "Consulta o resumo administrativo do dashboard com funil, financeiro "
                "e estoque. Ferramenta somente leitura."
            ),
            "inputSchema": empty_input_schema(),
            "annotations": read_only_annotations(),
        },
        {
            "name": "list_open_leads",
            "title": "Leads abertos",
            "description": (
                "Lista leads abertos para priorizacao comercial. Nao retorna telefone "
                "ou email neste primeiro ciclo."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 50,
                        "default": 20,
                    },
                    "stage": {
                        "type": "string",
                        "enum": list(LEAD_STAGES),
                    },
                    "search": {
                        "type": "string",
                        "maxLength": 120,
                    },
                },
                "additionalProperties": False,
            },
            "annotations": read_only_annotations(),
        },
        {
            "name": "list_overdue_financial_items",
            "title": "Financeiro vencido",
            "description": "Lista contas em aberto com vencimento anterior a hoje.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 50,
                        "default": 20,
                    },
                    "transaction_type": {
                        "type": "string",
                        "enum": ["receivable", "payable"],
                    },
                },
                "additionalProperties": False,
            },
            "annotations": read_only_annotations(),
        },
        {
            "name": "list_low_stock_items",
            "title": "Estoque critico",
            "description": "Lista itens ativos abaixo ou no minimo de estoque.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "limit": {
                        "type": "integer",
                        "minimum": 1,
                        "maximum": 50,
                        "default": 20,
                    },
                    "category": {
                        "type": "string",
                        "maxLength": 80,
                    },
                },
                "additionalProperties": False,
            },
            "annotations": read_only_annotations(),
        },
    ]


def get_write_tools() -> list[dict[str, Any]]:
    return [
        {
            "name": "create_lead",
            "title": "Criar lead",
            "description": (
                "Cria um lead no CRM administrativo. Use apenas quando o usuario "
                "pedir explicitamente para cadastrar um lead."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "minLength": 2, "maxLength": 160},
                    "phone": {"type": "string", "maxLength": 32},
                    "email": {"type": "string", "format": "email"},
                    "origin": {"type": "string", "maxLength": 80},
                    "stage": {"type": "string", "enum": list(LEAD_STAGES), "default": "novo"},
                    "estimated_value": {"type": "number", "minimum": 0},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["name"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "update_lead_stage",
            "title": "Mover lead no funil",
            "description": (
                "Atualiza a etapa do funil de um lead existente. Use apenas quando "
                "o usuario pedir explicitamente a mudanca."
            ),
            "inputSchema": {
                "type": "object",
                "properties": {
                    "lead_id": {"type": "string", "format": "uuid"},
                    "stage": {"type": "string", "enum": list(LEAD_STAGES)},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["lead_id", "stage"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "create_receivable",
            "title": "Criar conta a receber",
            "description": "Cria um lancamento financeiro de conta a receber.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "minLength": 2, "maxLength": 180},
                    "category": {"type": "string", "minLength": 2, "maxLength": 80},
                    "counterparty": {"type": "string", "maxLength": 160},
                    "amount": {"type": "number", "exclusiveMinimum": 0},
                    "due_date": {"type": "string", "format": "date"},
                    "payment_method": {"type": "string", "maxLength": 80},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["description", "category", "amount", "due_date"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "create_payable",
            "title": "Criar conta a pagar",
            "description": "Cria um lancamento financeiro de conta a pagar.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "minLength": 2, "maxLength": 180},
                    "category": {"type": "string", "minLength": 2, "maxLength": 80},
                    "counterparty": {"type": "string", "maxLength": 160},
                    "amount": {"type": "number", "exclusiveMinimum": 0},
                    "due_date": {"type": "string", "format": "date"},
                    "payment_method": {"type": "string", "maxLength": 80},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["description", "category", "amount", "due_date"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "mark_financial_transaction_paid",
            "title": "Marcar lancamento como pago",
            "description": "Marca uma conta financeira existente como paga.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "transaction_id": {"type": "string", "format": "uuid"},
                    "payment_method": {"type": "string", "maxLength": 80},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["transaction_id"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "create_inventory_item",
            "title": "Criar item de estoque",
            "description": "Cadastra um novo item no estoque.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "minLength": 2, "maxLength": 160},
                    "sku": {"type": "string", "maxLength": 80},
                    "category": {"type": "string", "maxLength": 80},
                    "unit": {"type": "string", "minLength": 1, "maxLength": 24, "default": "un"},
                    "current_quantity": {"type": "number", "minimum": 0, "default": 0},
                    "minimum_quantity": {"type": "number", "minimum": 0, "default": 0},
                    "cost_price": {"type": "number", "minimum": 0, "default": 0},
                    "supplier": {"type": "string", "maxLength": 160},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["name"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "register_inventory_movement",
            "title": "Registrar movimento de estoque",
            "description": "Registra entrada, saida ou ajuste de quantidade de um item.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "item_id": {"type": "string", "format": "uuid"},
                    "movement_type": {"type": "string", "enum": ["in", "out", "adjustment"]},
                    "quantity": {"type": "number", "exclusiveMinimum": 0},
                    "unit_cost": {"type": "number", "minimum": 0, "default": 0},
                    "reason": {"type": "string", "maxLength": 160},
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["item_id", "movement_type", "quantity"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "create_commission",
            "title": "Criar comissao",
            "description": "Cria uma comissao para controle gerencial.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "minLength": 2, "maxLength": 180},
                    "owner_id": {"type": "string", "format": "uuid"},
                    "base_amount": {"type": "number", "minimum": 0},
                    "percentage": {"type": "number", "minimum": 0},
                    "amount": {"type": "number", "minimum": 0},
                    "reference_date": {"type": "string", "format": "date"},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "approved", "paid", "canceled"],
                        "default": "pending",
                    },
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["description", "base_amount", "percentage", "reference_date"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
        {
            "name": "update_commission_status",
            "title": "Atualizar status de comissao",
            "description": "Atualiza o status de uma comissao existente.",
            "inputSchema": {
                "type": "object",
                "properties": {
                    "commission_id": {"type": "string", "format": "uuid"},
                    "status": {
                        "type": "string",
                        "enum": ["pending", "approved", "paid", "canceled"],
                    },
                    "notes": {"type": "string", "maxLength": 2000},
                },
                "required": ["commission_id", "status"],
                "additionalProperties": False,
            },
            "annotations": action_annotations(),
        },
    ]


def get_mcp_tools(settings: Settings) -> list[dict[str, Any]]:
    tools = get_read_tools()

    if settings.mcp_write_tools_enabled:
        tools = [*tools, *get_write_tools()]

    return tools


def clamp_limit(arguments: dict[str, Any], default: int = 20, maximum: int = 50) -> int:
    raw_limit = arguments.get("limit", default)

    if not isinstance(raw_limit, int):
        return default

    return max(1, min(raw_limit, maximum))


def optional_text(arguments: dict[str, Any], key: str, max_length: int) -> str | None:
    value = arguments.get(key)

    if not isinstance(value, str):
        return None

    value = value.strip()
    if not value:
        return None

    return value[:max_length]


def decimal_to_float(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return float(value)


def optional_decimal(arguments: dict[str, Any], key: str) -> Decimal | None:
    value = arguments.get(key)

    if value is None:
        return None

    try:
        return Decimal(str(value))
    except Exception:  # noqa: BLE001
        return None


def required_uuid(arguments: dict[str, Any], key: str) -> UUID:
    value = arguments.get(key)

    if not isinstance(value, str):
        raise ValueError(f"{key} e obrigatorio.")

    try:
        return UUID(value)
    except ValueError as exc:
        raise ValueError(f"{key} deve ser um UUID valido.") from exc


def validation_error(exc: ValidationError) -> ValueError:
    return ValueError(exc.errors())


def extract_bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None

    scheme, _, value = authorization.partition(" ")
    if scheme.lower() != "bearer" or not value.strip():
        return None

    return value.strip()


def is_mcp_request_authorized(
    settings: Settings,
    *,
    authorization: str | None = None,
    header_token: str | None = None,
    query_token: str | None = None,
) -> bool:
    if not settings.mcp_auth_enabled:
        return True

    bearer_token = extract_bearer_token(authorization)
    if is_valid_mcp_oauth_token(bearer_token):
        return True

    expected_token = settings.mcp_auth_token.strip() if settings.mcp_auth_token else ""
    if not expected_token:
        return False

    candidates = [
        bearer_token,
        header_token.strip() if header_token else None,
    ]

    if settings.mcp_allow_query_token:
        candidates.append(query_token.strip() if query_token else None)

    return any(
        secrets.compare_digest(candidate, expected_token)
        for candidate in candidates
        if candidate
    )


def safe_audit_payload(value: Any, max_string_length: int = 1000) -> Any:
    encoded_value = jsonable_encoder(value)

    if isinstance(encoded_value, str):
        return encoded_value[:max_string_length]

    if isinstance(encoded_value, list):
        return [safe_audit_payload(item, max_string_length) for item in encoded_value[:50]]

    if isinstance(encoded_value, dict):
        return {
            str(key): safe_audit_payload(item, max_string_length)
            for key, item in list(encoded_value.items())[:50]
        }

    return encoded_value


def summarize_tool_result(result: dict[str, Any] | None) -> dict[str, Any] | None:
    if not isinstance(result, dict):
        return None

    data = result.get("data")
    summary: dict[str, Any] = {
        "type": result.get("type"),
        "count": result.get("count"),
    }

    if isinstance(data, dict):
        summary["data_id"] = data.get("id")
        summary["data_status"] = data.get("status")
        summary["data_name"] = data.get("name") or data.get("description")

    return {key: value for key, value in summary.items() if value is not None}


def record_mcp_audit_log(
    db: Session,
    settings: Settings,
    *,
    tool_name: str,
    request_id: Any,
    arguments: dict[str, Any],
    success: bool,
    is_write_tool: bool,
    result: dict[str, Any] | None = None,
    error_message: str | None = None,
    remote_addr: str | None = None,
    user_agent: str | None = None,
    elapsed_ms: int | None = None,
) -> None:
    if not settings.mcp_audit_enabled:
        return

    try:
        create_mcp_audit_log(
            db,
            McpAuditLog(
                tool_name=tool_name,
                request_id=str(request_id) if request_id is not None else None,
                is_write_tool=is_write_tool,
                success=success,
                arguments=safe_audit_payload(arguments),
                result_summary=summarize_tool_result(result),
                error_message=error_message[:2000] if error_message else None,
                remote_addr=remote_addr,
                user_agent=user_agent[:255] if user_agent else None,
                elapsed_ms=elapsed_ms,
            ),
        )
    except Exception:  # noqa: BLE001
        db.rollback()


def record_mcp_auth_failure(
    db: Session,
    settings: Settings,
    *,
    reason: str,
    remote_addr: str | None = None,
    user_agent: str | None = None,
) -> None:
    record_mcp_audit_log(
        db,
        settings,
        tool_name="__auth__",
        request_id=None,
        arguments={"reason": reason},
        success=False,
        is_write_tool=False,
        error_message=reason,
        remote_addr=remote_addr,
        user_agent=user_agent,
    )


def dashboard_summary_tool(db: Session, _arguments: dict[str, Any]) -> dict[str, Any]:
    summary = get_dashboard_summary(db)
    return {
        "type": "dashboard_summary",
        "data": jsonable_encoder(summary),
    }


def list_open_leads_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    stage = optional_text(arguments, "stage", 32)
    if stage not in LEAD_STAGES:
        stage = None

    leads = list_leads_page(
        db,
        limit=clamp_limit(arguments),
        search=optional_text(arguments, "search", 120),
        stage=stage,
        status="open",
    )

    return {
        "type": "open_leads",
        "count": len(leads),
        "data": [
            {
                "id": str(lead.id),
                "name": lead.name,
                "origin": lead.origin,
                "stage": lead.stage,
                "status": lead.status,
                "estimated_value": decimal_to_float(lead.estimated_value),
                "next_follow_up_at": lead.next_follow_up_at,
                "last_contact_at": lead.last_contact_at,
                "owner_name": lead.owner.name if lead.owner else None,
                "created_at": lead.created_at,
                "updated_at": lead.updated_at,
            }
            for lead in leads
        ],
    }


def list_overdue_financial_items_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    today = date.today()
    transaction_type = optional_text(arguments, "transaction_type", 24)
    if transaction_type not in {"receivable", "payable"}:
        transaction_type = None

    transactions = list_financial_transactions_page(
        db,
        limit=clamp_limit(arguments),
        transaction_type=transaction_type,
        status="open",
        due_to=today,
    )
    overdue = [transaction for transaction in transactions if transaction.due_date < today]

    return {
        "type": "overdue_financial_items",
        "count": len(overdue),
        "data": [
            {
                "id": str(transaction.id),
                "description": transaction.description,
                "transaction_type": transaction.transaction_type,
                "category": transaction.category,
                "counterparty": transaction.counterparty,
                "amount": decimal_to_float(transaction.amount),
                "due_date": transaction.due_date,
                "days_overdue": (today - transaction.due_date).days,
                "status": transaction.status,
            }
            for transaction in overdue
        ],
    }


def list_low_stock_items_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    items = list_inventory_items_page(
        db,
        limit=clamp_limit(arguments),
        category=optional_text(arguments, "category", 80),
        low_stock=True,
        is_active=True,
    )

    return {
        "type": "low_stock_items",
        "count": len(items),
        "data": [
            {
                "id": str(item.id),
                "name": item.name,
                "sku": item.sku,
                "category": item.category,
                "current_quantity": decimal_to_float(item.current_quantity),
                "minimum_quantity": decimal_to_float(item.minimum_quantity),
                "unit": item.unit,
                "supplier": item.supplier,
                "stock_status": item.stock_status,
            }
            for item in items
        ],
    }


def lead_to_payload(lead: Any, result_type: str) -> dict[str, Any]:
    return {
        "type": result_type,
        "data": {
            "id": str(lead.id),
            "name": lead.name,
            "phone": lead.phone,
            "email": lead.email,
            "origin": lead.origin,
            "stage": lead.stage,
            "status": lead.status,
            "estimated_value": decimal_to_float(lead.estimated_value),
            "notes": lead.notes,
            "next_follow_up_at": lead.next_follow_up_at,
            "last_contact_at": lead.last_contact_at,
            "owner_name": lead.owner.name if lead.owner else None,
            "created_at": lead.created_at,
            "updated_at": lead.updated_at,
        },
    }


def create_lead_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    estimated_value = optional_decimal(arguments, "estimated_value")
    payload_data = {
        "name": arguments.get("name"),
        "phone": optional_text(arguments, "phone", 32),
        "email": optional_text(arguments, "email", 255),
        "origin": optional_text(arguments, "origin", 80),
        "stage": optional_text(arguments, "stage", 40) or "novo",
        "estimated_value": estimated_value if estimated_value is not None else Decimal("0.00"),
        "notes": optional_text(arguments, "notes", 2000),
    }

    try:
        payload = LeadCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise ValueError(exc.errors()) from exc

    lead = create_lead(db, payload)
    return lead_to_payload(lead, "created_lead")


def update_lead_stage_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    lead_id = arguments.get("lead_id")
    stage = optional_text(arguments, "stage", 40)

    if not isinstance(lead_id, str):
        raise ValueError("lead_id e obrigatorio.")

    if stage not in LEAD_STAGES:
        raise ValueError("stage invalido.")

    try:
        parsed_lead_id = UUID(lead_id)
    except ValueError as exc:
        raise ValueError("lead_id deve ser um UUID valido.") from exc

    payload_data = {"stage": stage}
    notes = optional_text(arguments, "notes", 2000)
    if notes is not None:
        payload_data["notes"] = notes

    payload = LeadUpdate.model_validate(payload_data)
    lead = get_lead_or_404(db, parsed_lead_id)
    updated_lead = update_lead(db, lead, payload)
    return lead_to_payload(updated_lead, "updated_lead_stage")


def financial_transaction_to_payload(transaction: Any, result_type: str) -> dict[str, Any]:
    return {
        "type": result_type,
        "data": {
            "id": str(transaction.id),
            "description": transaction.description,
            "transaction_type": transaction.transaction_type,
            "category": transaction.category,
            "counterparty": transaction.counterparty,
            "amount": decimal_to_float(transaction.amount),
            "due_date": transaction.due_date,
            "paid_at": transaction.paid_at,
            "status": transaction.status,
            "payment_method": transaction.payment_method,
            "notes": transaction.notes,
            "created_at": transaction.created_at,
            "updated_at": transaction.updated_at,
        },
    }


def create_financial_transaction_tool(
    db: Session,
    arguments: dict[str, Any],
    transaction_type: str,
) -> dict[str, Any]:
    payload_data = {
        "description": arguments.get("description"),
        "transaction_type": transaction_type,
        "category": arguments.get("category"),
        "counterparty": optional_text(arguments, "counterparty", 160),
        "amount": optional_decimal(arguments, "amount"),
        "due_date": arguments.get("due_date"),
        "payment_method": optional_text(arguments, "payment_method", 80),
        "notes": optional_text(arguments, "notes", 2000),
    }

    try:
        payload = FinancialTransactionCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise validation_error(exc) from exc

    transaction = create_financial_transaction(db, payload)
    return financial_transaction_to_payload(transaction, f"created_{transaction_type}")


def create_receivable_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    return create_financial_transaction_tool(db, arguments, "receivable")


def create_payable_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    return create_financial_transaction_tool(db, arguments, "payable")


def mark_financial_transaction_paid_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    transaction = get_financial_transaction_or_404(db, required_uuid(arguments, "transaction_id"))
    payload_data = {
        "status": "paid",
        "payment_method": optional_text(arguments, "payment_method", 80),
    }
    notes = optional_text(arguments, "notes", 2000)
    if notes is not None:
        payload_data["notes"] = notes

    payload = FinancialTransactionUpdate.model_validate(payload_data)
    updated_transaction = update_financial_transaction(db, transaction, payload)
    return financial_transaction_to_payload(updated_transaction, "paid_financial_transaction")


def inventory_item_to_payload(item: Any, result_type: str) -> dict[str, Any]:
    return {
        "type": result_type,
        "data": {
            "id": str(item.id),
            "name": item.name,
            "sku": item.sku,
            "category": item.category,
            "unit": item.unit,
            "current_quantity": decimal_to_float(item.current_quantity),
            "minimum_quantity": decimal_to_float(item.minimum_quantity),
            "cost_price": decimal_to_float(item.cost_price),
            "supplier": item.supplier,
            "notes": item.notes,
            "is_active": item.is_active,
            "stock_status": item.stock_status,
            "created_at": item.created_at,
            "updated_at": item.updated_at,
        },
    }


def create_inventory_item_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    payload_data = {
        "name": arguments.get("name"),
        "sku": optional_text(arguments, "sku", 80),
        "category": optional_text(arguments, "category", 80),
        "unit": optional_text(arguments, "unit", 24) or "un",
        "current_quantity": optional_decimal(arguments, "current_quantity") or Decimal("0.000"),
        "minimum_quantity": optional_decimal(arguments, "minimum_quantity") or Decimal("0.000"),
        "cost_price": optional_decimal(arguments, "cost_price") or Decimal("0.00"),
        "supplier": optional_text(arguments, "supplier", 160),
        "notes": optional_text(arguments, "notes", 2000),
    }

    try:
        payload = InventoryItemCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise validation_error(exc) from exc

    item = create_inventory_item(db, payload)
    return inventory_item_to_payload(item, "created_inventory_item")


def register_inventory_movement_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    payload_data = {
        "item_id": required_uuid(arguments, "item_id"),
        "movement_type": arguments.get("movement_type"),
        "quantity": optional_decimal(arguments, "quantity"),
        "unit_cost": optional_decimal(arguments, "unit_cost") or Decimal("0.00"),
        "reason": optional_text(arguments, "reason", 160),
        "notes": optional_text(arguments, "notes", 2000),
    }

    try:
        payload = InventoryMovementCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise validation_error(exc) from exc

    movement = create_inventory_movement(db, payload)
    return {
        "type": "registered_inventory_movement",
        "data": {
            "id": str(movement.id),
            "item_id": str(movement.item_id),
            "movement_type": movement.movement_type,
            "quantity": decimal_to_float(movement.quantity),
            "unit_cost": decimal_to_float(movement.unit_cost),
            "reason": movement.reason,
            "notes": movement.notes,
            "occurred_at": movement.occurred_at,
            "created_at": movement.created_at,
            "updated_at": movement.updated_at,
        },
    }


def commission_to_payload(commission: Any, result_type: str) -> dict[str, Any]:
    return {
        "type": result_type,
        "data": {
            "id": str(commission.id),
            "description": commission.description,
            "owner_id": str(commission.owner_id) if commission.owner_id else None,
            "owner_name": commission.owner.name if commission.owner else None,
            "base_amount": decimal_to_float(commission.base_amount),
            "percentage": decimal_to_float(commission.percentage),
            "amount": decimal_to_float(commission.amount),
            "reference_date": commission.reference_date,
            "status": commission.status,
            "paid_at": commission.paid_at,
            "notes": commission.notes,
            "created_at": commission.created_at,
            "updated_at": commission.updated_at,
        },
    }


def create_commission_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    owner_id = arguments.get("owner_id")
    payload_data = {
        "description": arguments.get("description"),
        "owner_id": required_uuid(arguments, "owner_id") if isinstance(owner_id, str) else None,
        "base_amount": optional_decimal(arguments, "base_amount"),
        "percentage": optional_decimal(arguments, "percentage"),
        "amount": optional_decimal(arguments, "amount"),
        "reference_date": arguments.get("reference_date"),
        "status": optional_text(arguments, "status", 24) or "pending",
        "notes": optional_text(arguments, "notes", 2000),
    }

    try:
        payload = CommissionCreate.model_validate(payload_data)
    except ValidationError as exc:
        raise validation_error(exc) from exc

    commission = create_commission(db, payload)
    return commission_to_payload(commission, "created_commission")


def update_commission_status_tool(db: Session, arguments: dict[str, Any]) -> dict[str, Any]:
    commission = get_commission_or_404(db, required_uuid(arguments, "commission_id"))
    payload_data = {
        "status": arguments.get("status"),
    }
    notes = optional_text(arguments, "notes", 2000)
    if notes is not None:
        payload_data["notes"] = notes

    try:
        payload = CommissionUpdate.model_validate(payload_data)
    except ValidationError as exc:
        raise validation_error(exc) from exc

    updated_commission = update_commission(db, commission, payload)
    return commission_to_payload(updated_commission, "updated_commission_status")


TOOL_HANDLERS = {
    "get_dashboard_summary": dashboard_summary_tool,
    "list_open_leads": list_open_leads_tool,
    "list_overdue_financial_items": list_overdue_financial_items_tool,
    "list_low_stock_items": list_low_stock_items_tool,
}

WRITE_TOOL_HANDLERS = {
    "create_lead": create_lead_tool,
    "update_lead_stage": update_lead_stage_tool,
    "create_receivable": create_receivable_tool,
    "create_payable": create_payable_tool,
    "mark_financial_transaction_paid": mark_financial_transaction_paid_tool,
    "create_inventory_item": create_inventory_item_tool,
    "register_inventory_movement": register_inventory_movement_tool,
    "create_commission": create_commission_tool,
    "update_commission_status": update_commission_status_tool,
}


def get_tool_handlers(settings: Settings) -> dict[str, Any]:
    if settings.mcp_write_tools_enabled:
        return {**TOOL_HANDLERS, **WRITE_TOOL_HANDLERS}

    return TOOL_HANDLERS



def tool_result(payload: dict[str, Any]) -> dict[str, Any]:
    encoded_payload = jsonable_encoder(payload)
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(encoded_payload, ensure_ascii=False, indent=2),
            }
        ],
        "structuredContent": encoded_payload,
        "isError": False,
    }


def tool_error(message: str) -> dict[str, Any]:
    return {
        "content": [
            {
                "type": "text",
                "text": message,
            }
        ],
        "isError": True,
    }


def initialize_result(settings: Settings, requested_version: str | None) -> dict[str, Any]:
    protocol_version = requested_version or MCP_PROTOCOL_VERSION

    if protocol_version != MCP_PROTOCOL_VERSION:
        protocol_version = MCP_PROTOCOL_VERSION

    return {
        "protocolVersion": protocol_version,
        "capabilities": {
            "tools": {
                "listChanged": False,
            },
        },
        "serverInfo": {
            "name": settings.mcp_server_name,
            "title": "Clinica Gestao",
            "version": MCP_SERVER_VERSION,
        },
        "instructions": (
            "Conector administrativo da clinica. Use as ferramentas para consultar "
            "CRM, financeiro, estoque e dashboard. Ferramentas de escrita podem "
            "alterar dados administrativos e devem ser usadas apenas quando o "
            "usuario pedir explicitamente. Nao exponha dados clinicos ou prontuario."
        ),
    }


def json_rpc_success(request_id: Any, result: dict[str, Any]) -> dict[str, Any]:
    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": result,
    }


def json_rpc_error(
    request_id: Any,
    code: int,
    message: str,
    data: dict[str, Any] | None = None,
) -> dict[str, Any]:
    error: dict[str, Any] = {
        "code": code,
        "message": message,
    }

    if data is not None:
        error["data"] = data

    return {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": error,
    }


def handle_mcp_request(
    payload: dict[str, Any],
    db: Session,
    settings: Settings,
    *,
    remote_addr: str | None = None,
    user_agent: str | None = None,
) -> dict[str, Any] | None:
    if payload.get("jsonrpc") != "2.0":
        return json_rpc_error(payload.get("id"), -32600, "Invalid JSON-RPC request.")

    method = payload.get("method")
    request_id = payload.get("id")

    if not isinstance(method, str):
        return json_rpc_error(request_id, -32600, "Missing method.")

    if request_id is None:
        return None

    params = payload.get("params") or {}
    if not isinstance(params, dict):
        return json_rpc_error(request_id, -32602, "Invalid params.")

    if method == "initialize":
        requested_version = params.get("protocolVersion")
        return json_rpc_success(
            request_id,
            initialize_result(
                settings,
                requested_version if isinstance(requested_version, str) else None,
            ),
        )

    if method == "ping":
        return json_rpc_success(request_id, {})

    if method == "tools/list":
        return json_rpc_success(request_id, {"tools": get_mcp_tools(settings)})

    if method == "tools/call":
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}

        if not isinstance(tool_name, str):
            return json_rpc_error(request_id, -32602, "Missing tool name.")

        if not isinstance(arguments, dict):
            return json_rpc_error(request_id, -32602, "Invalid tool arguments.")

        handler = get_tool_handlers(settings).get(tool_name)
        if handler is None:
            record_mcp_audit_log(
                db,
                settings,
                tool_name=tool_name,
                request_id=request_id,
                arguments=arguments,
                success=False,
                is_write_tool=tool_name in WRITE_TOOL_HANDLERS,
                error_message=f"Unknown tool: {tool_name}",
                remote_addr=remote_addr,
                user_agent=user_agent,
            )
            return json_rpc_error(request_id, -32602, f"Unknown tool: {tool_name}")

        started_at = time.perf_counter()
        is_write_tool = tool_name in WRITE_TOOL_HANDLERS

        try:
            result = handler(db, arguments)
        except Exception as exc:  # noqa: BLE001
            db.rollback()
            elapsed_ms = int((time.perf_counter() - started_at) * 1000)
            error_message = str(exc)
            record_mcp_audit_log(
                db,
                settings,
                tool_name=tool_name,
                request_id=request_id,
                arguments=arguments,
                success=False,
                is_write_tool=is_write_tool,
                error_message=error_message,
                remote_addr=remote_addr,
                user_agent=user_agent,
                elapsed_ms=elapsed_ms,
            )
            return json_rpc_success(request_id, tool_error(str(exc)))

        elapsed_ms = int((time.perf_counter() - started_at) * 1000)
        record_mcp_audit_log(
            db,
            settings,
            tool_name=tool_name,
            request_id=request_id,
            arguments=arguments,
            success=True,
            is_write_tool=is_write_tool,
            result=result,
            remote_addr=remote_addr,
            user_agent=user_agent,
            elapsed_ms=elapsed_ms,
        )

        return json_rpc_success(request_id, tool_result(result))

    return json_rpc_error(request_id, -32601, f"Method not found: {method}")
