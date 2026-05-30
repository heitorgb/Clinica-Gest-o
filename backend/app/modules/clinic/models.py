from sqlalchemy import String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class ClinicSettings(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "clinic_settings"

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    legal_name: Mapped[str | None] = mapped_column(String(180))
    document: Mapped[str | None] = mapped_column(String(32))
    phone: Mapped[str | None] = mapped_column(String(32))
    email: Mapped[str | None] = mapped_column(String(255))
    timezone: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="America/Sao_Paulo",
        server_default="America/Sao_Paulo",
    )
    currency: Mapped[str] = mapped_column(
        String(3),
        nullable=False,
        default="BRL",
        server_default="BRL",
    )
