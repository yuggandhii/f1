"""app/models/circuit.py — Circuit / track ORM model."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Circuit(Base):
    __tablename__ = "circuits"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    name: Mapped[str] = mapped_column(String, nullable=False)
    country: Mapped[str | None] = mapped_column(String, nullable=True)
    # street / permanent / mixed
    track_type: Mapped[str | None] = mapped_column(String, nullable=True)
    lap_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # 0.0–1.0 (1.0 = very hard to overtake)
    overtake_difficulty: Mapped[float | None] = mapped_column(Float, nullable=True)
    # 0.0–1.0 (1.0 = highly variable weather)
    weather_variability: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Geographic coordinates for weather API lookups
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)

    # Safety car / VSC probability from historical FastF1 track_status data
    sc_probability: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.3)
    vsc_probability: Mapped[float | None] = mapped_column(Float, nullable=True, default=0.15)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    race_results: Mapped[list["RaceResult"]] = relationship(  # noqa: F821
        "RaceResult", back_populates="circuit", lazy="select"
    )
    weather_forecasts: Mapped[list["RaceWeatherForecast"]] = relationship(  # noqa: F821
        "RaceWeatherForecast", back_populates="circuit", lazy="select"
    )

    def __repr__(self) -> str:
        return f"<Circuit id={self.id} name={self.name!r} country={self.country!r}>"
