"""app/models/race_weather_forecast.py — OpenMeteo weather forecast for race weekends."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class RaceWeatherForecast(Base):
    __tablename__ = "race_weather_forecasts"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    circuit_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("circuits.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    race_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    # 0.0–1.0 probability of precipitation on race day at race time
    precipitation_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    # dry / mixed / wet based on precipitation_probability threshold
    predicted_condition: Mapped[str | None] = mapped_column(String, nullable=True)
    fetched_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    circuit: Mapped["Circuit"] = relationship(  # noqa: F821
        "Circuit", back_populates="weather_forecasts", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<RaceWeatherForecast circuit={self.circuit_id} "
            f"date={self.race_date} condition={self.predicted_condition!r}>"
        )
