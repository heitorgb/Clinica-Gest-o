from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, Date, DateTime, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.users.models import User

GOAL_METRICS = ("revenue", "leads", "won_leads", "conversion")
GOAL_STATUSES = ("active", "completed", "paused", "canceled")
COMMISSION_STATUSES = ("pending", "approved", "paid", "canceled")


class PerformanceGoal(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "performance_goals"
    __table_args__ = (
        CheckConstraint(f"metric in {GOAL_METRICS}", name="performance_goal_metric_valid"),
        CheckConstraint(f"status in {GOAL_STATUSES}", name="performance_goal_status_valid"),
        CheckConstraint("target_value > 0", name="performance_goal_target_value_valid"),
        CheckConstraint("current_value >= 0", name="performance_goal_current_value_valid"),
        CheckConstraint("period_end >= period_start", name="performance_goal_period_valid"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    metric: Mapped[str] = mapped_column(String(40), nullable=False)
    target_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    current_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0",
    )
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_end: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="active",
        server_default="active",
    )
    owner_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    notes: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[User | None] = relationship(lazy="selectin")

    @property
    def owner_name(self) -> str | None:
        if self.owner is None:
            return None
        return self.owner.name

    @property
    def progress_percent(self) -> Decimal:
        if self.target_value <= 0:
            return Decimal("0.00")
        progress = (self.current_value / self.target_value) * Decimal("100")
        return progress.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


class Commission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "commissions"
    __table_args__ = (
        CheckConstraint(f"status in {COMMISSION_STATUSES}", name="commission_status_valid"),
        CheckConstraint("base_amount >= 0", name="commission_base_amount_valid"),
        CheckConstraint("percentage >= 0", name="commission_percentage_valid"),
        CheckConstraint("amount >= 0", name="commission_amount_valid"),
    )

    description: Mapped[str] = mapped_column(String(180), nullable=False)
    owner_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    base_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    percentage: Mapped[Decimal] = mapped_column(Numeric(5, 2), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reference_date: Mapped[date] = mapped_column(Date, nullable=False)
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="pending",
        server_default="pending",
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)
    owner: Mapped[User | None] = relationship(lazy="selectin")

    @property
    def owner_name(self) -> str | None:
        if self.owner is None:
            return None
        return self.owner.name
