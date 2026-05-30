from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.modules.crm.schemas import PipelineStageSummary
from app.modules.finance.schemas import FinancialSummary
from app.modules.inventory.schemas import InventorySummary


class DashboardMetrics(BaseModel):
    open_leads: int
    pipeline_value: Decimal
    receivable_open: Decimal
    forecast_balance: Decimal
    low_stock_items: int
    overdue_total: Decimal


class DashboardReceivable(BaseModel):
    id: UUID
    description: str
    counterparty: str | None = None
    amount: Decimal
    due_date: date
    status: str


class DashboardStockAlert(BaseModel):
    id: UUID
    name: str
    category: str | None = None
    current_quantity: Decimal
    minimum_quantity: Decimal
    unit: str


class DashboardSummary(BaseModel):
    metrics: DashboardMetrics
    pipeline: list[PipelineStageSummary]
    finance: FinancialSummary
    inventory: InventorySummary
    upcoming_receivables: list[DashboardReceivable]
    stock_alerts: list[DashboardStockAlert]
