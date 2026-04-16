"""app/models/team.py — Team / constructor ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    constructor_name: Mapped[str | None] = mapped_column(String, nullable=True)
    power_unit: Mapped[str | None] = mapped_column(String, nullable=True)
    # 0.0–1.0 composite performance score
    base_performance: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    drivers: Mapped[list["Driver"]] = relationship(  # noqa: F821
        "Driver", back_populates="team", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Team id={self.id} name={self.name!r}>"
