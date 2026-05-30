from datetime import datetime
from decimal import Decimal
from uuid import UUID

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Numeric, String, Text, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin
from app.modules.users.models import User

LEAD_STAGES = ("novo", "contato", "qualificacao", "proposta", "negociacao")
LEAD_STATUSES = ("open", "won", "lost")


class Lead(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "leads"
    __table_args__ = (
        CheckConstraint(
            f"stage in {LEAD_STAGES}",
            name="lead_stage_valid",
        ),
        CheckConstraint(
            f"status in {LEAD_STATUSES}",
            name="lead_status_valid",
        ),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    origin: Mapped[str | None] = mapped_column(String(80))
    stage: Mapped[str] = mapped_column(
        String(40),
        nullable=False,
        default="novo",
        server_default="novo",
    )
    status: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="open",
        server_default="open",
    )
    estimated_value: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default="0",
    )
    notes: Mapped[str | None] = mapped_column(Text)
    next_follow_up_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_contact_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[UUID | None] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    owner: Mapped[User | None] = relationship(lazy="selectin")

    @property
    def owner_name(self) -> str | None:
        if self.owner is None:
            return None
        return self.owner.name
