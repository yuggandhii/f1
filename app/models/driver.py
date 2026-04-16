"""app/models/driver.py — Driver ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Driver(Base):
    __tablename__ = "drivers"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    abbreviation: Mapped[str | None] = mapped_column(String(3), nullable=True)
    team_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("teams.id", ondelete="SET NULL"), nullable=True
    )
    nationality: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    team: Mapped["Team"] = relationship(  # noqa: F821
        "Team", back_populates="drivers", lazy="select"
    )
    race_results: Mapped[list["RaceResult"]] = relationship(  # noqa: F821
        "RaceResult", back_populates="driver", lazy="select"
    )
    rating: Mapped["DriverRating | None"] = relationship(  # noqa: F821
        "DriverRating", back_populates="driver", uselist=False, lazy="select"
    )
    simulation_results: Mapped[list["SimulationResult"]] = relationship(  # noqa: F821
        "SimulationResult", back_populates="driver", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Driver id={self.id} name={self.name!r} abbr={self.abbreviation!r}>"
