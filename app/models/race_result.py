"""app/models/race_result.py — Historical race result ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RaceResult(Base):
    __tablename__ = "race_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    circuit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("circuits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    season: Mapped[int] = mapped_column(Integer, nullable=False, index=True)
    round: Mapped[int] = mapped_column(Integer, nullable=False)
    grid_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    finish_position: Mapped[int | None] = mapped_column(Integer, nullable=True)
    points: Mapped[float | None] = mapped_column(Float, nullable=True)
    dnf: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # mechanical / crash / other
    dnf_cause: Mapped[str | None] = mapped_column(String, nullable=True)
    fastest_lap: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    # dry / wet / mixed
    weather: Mapped[str | None] = mapped_column(String, nullable=True)
    race_time_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    driver: Mapped["Driver"] = relationship(  # noqa: F821
        "Driver", back_populates="race_results", lazy="select"
    )
    circuit: Mapped["Circuit"] = relationship(  # noqa: F821
        "Circuit", back_populates="race_results", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<RaceResult driver={self.driver_id} circuit={self.circuit_id} "
            f"season={self.season} round={self.round} pos={self.finish_position}>"
        )
