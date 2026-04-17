"""app/models/driver_rating.py — Derived driver performance ratings ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DriverRating(Base):
    __tablename__ = "driver_ratings"
    __table_args__ = (
        UniqueConstraint("driver_id", "season", name="uq_driver_rating_driver_season"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    season: Mapped[int] = mapped_column(Integer, nullable=False)

    # All values normalised 0.0–1.0
    base_pace: Mapped[float | None] = mapped_column(Float, nullable=True)
    consistency: Mapped[float | None] = mapped_column(Float, nullable=True)
    wet_skill: Mapped[float | None] = mapped_column(Float, nullable=True)
    tyre_management: Mapped[float | None] = mapped_column(Float, nullable=True)
    overtake_skill: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Lower is better (historical DNF fraction)
    dnf_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    qualifying_edge: Mapped[float | None] = mapped_column(Float, nullable=True)
    speed_rating: Mapped[float | None] = mapped_column(Float, nullable=True)
    pit_efficiency: Mapped[float | None] = mapped_column(Float, nullable=True)

    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    driver: Mapped["Driver"] = relationship(  # noqa: F821
        "Driver", back_populates="rating", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<DriverRating driver={self.driver_id} season={self.season} "
            f"pace={self.base_pace:.3f}>"
        )
