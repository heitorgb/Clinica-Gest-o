from decimal import Decimal

from app.modules.crm.schemas import PipelineStageSummary
from app.modules.dashboard.service import build_dashboard_metrics
from app.modules.finance.schemas import FinancialSummary
from app.modules.inventory.schemas import InventorySummary


def test_build_dashboard_metrics() -> None:
    pipeline = [
        PipelineStageSummary(
            stage="novo",
            leads_count=2,
            estimated_value=Decimal("1500.00"),
        ),
        PipelineStageSummary(
            stage="contato",
            leads_count=3,
            estimated_value=Decimal("2500.00"),
        ),
    ]
    finance = FinancialSummary(
        receivable_open=Decimal("8400.00"),
        payable_open=Decimal("1200.00"),
        overdue_total=Decimal("900.00"),
        paid_balance=Decimal("3000.00"),
        forecast_balance=Decimal("7200.00"),
    )
    inventory = InventorySummary(
        total_items=10,
        low_stock_items=2,
        inactive_items=1,
        total_stock_value=Decimal("5000.00"),
    )

    metrics = build_dashboard_metrics(pipeline, finance, inventory)

    assert metrics.open_leads == 5
    assert metrics.pipeline_value == Decimal("4000.00")
    assert metrics.receivable_open == Decimal("8400.00")
    assert metrics.forecast_balance == Decimal("7200.00")
    assert metrics.low_stock_items == 2
    assert metrics.overdue_total == Decimal("900.00")
