from datetime import date

from sqlalchemy.orm import Session

from app.modules.crm.schemas import PipelineStageSummary
from app.modules.crm.service import get_pipeline_summary
from app.modules.dashboard.schemas import (
    DashboardMetrics,
    DashboardReceivable,
    DashboardStockAlert,
    DashboardSummary,
)
from app.modules.finance.schemas import FinancialSummary
from app.modules.finance.service import get_financial_summary, list_financial_transactions_page
from app.modules.inventory.schemas import InventorySummary
from app.modules.inventory.service import get_inventory_summary, list_inventory_items_page


def build_dashboard_metrics(
    pipeline: list[PipelineStageSummary],
    finance: FinancialSummary,
    inventory: InventorySummary,
) -> DashboardMetrics:
    return DashboardMetrics(
        open_leads=sum(stage.leads_count for stage in pipeline),
        pipeline_value=sum(stage.estimated_value for stage in pipeline),
        receivable_open=finance.receivable_open,
        forecast_balance=finance.forecast_balance,
        low_stock_items=inventory.low_stock_items,
        overdue_total=finance.overdue_total,
    )


def get_dashboard_summary(db: Session) -> DashboardSummary:
    pipeline = get_pipeline_summary(db)
    finance = get_financial_summary(db)
    inventory = get_inventory_summary(db)

    upcoming_receivables = list_financial_transactions_page(
        db,
        limit=5,
        transaction_type="receivable",
        status="open",
        due_from=date.today(),
    )
    stock_alert_items = list_inventory_items_page(
        db,
        limit=5,
        low_stock=True,
        is_active=True,
    )

    return DashboardSummary(
        metrics=build_dashboard_metrics(pipeline, finance, inventory),
        pipeline=pipeline,
        finance=finance,
        inventory=inventory,
        upcoming_receivables=[
            DashboardReceivable(
                id=transaction.id,
                description=transaction.description,
                counterparty=transaction.counterparty,
                amount=transaction.amount,
                due_date=transaction.due_date,
                status=transaction.status,
            )
            for transaction in upcoming_receivables
        ],
        stock_alerts=[
            DashboardStockAlert(
                id=item.id,
                name=item.name,
                category=item.category,
                current_quantity=item.current_quantity,
                minimum_quantity=item.minimum_quantity,
                unit=item.unit,
            )
            for item in stock_alert_items
        ],
    )
