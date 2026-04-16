"""app/models/simulation_run.py — Simulation run + aggregated results ORM models."""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    n_simulations: Mapped[int] = mapped_column(Integer, nullable=False)
    randomness_factor: Mapped[float] = mapped_column(Float, nullable=False, default=0.15)
    # What-if parameters as free-form JSON
    scenario: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # pending / running / done / failed
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending")
    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Path to the parquet file: data/simulations/{run_id}/results.parquet
    result_path: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    # Relationships
    results: Mapped[list["SimulationResult"]] = relationship(
        "SimulationResult", back_populates="run", lazy="select", cascade="all, delete-orphan"
    )

    def __repr__(self) -> str:
        return (
            f"<SimulationRun id={self.id} season={self.season} "
            f"n={self.n_simulations} status={self.status!r}>"
        )


class SimulationResult(Base):
    """Aggregated per-driver result for a given simulation run (not raw parquet rows)."""

    __tablename__ = "simulation_results"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("simulation_runs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    driver_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("drivers.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    wdc_probability: Mapped[float | None] = mapped_column(Float, nullable=True)
    expected_points: Mapped[float | None] = mapped_column(Float, nullable=True)
    points_std: Mapped[float | None] = mapped_column(Float, nullable=True)
    # Total race wins across all simulations
    p1_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    podium_rate: Mapped[float | None] = mapped_column(Float, nullable=True)
    dnf_rate_simulated: Mapped[float | None] = mapped_column(Float, nullable=True)
    # {circuit_id: win_probability} stored as JSONB
    per_race_win_probs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    # Relationships
    run: Mapped["SimulationRun"] = relationship(
        "SimulationRun", back_populates="results", lazy="select"
    )
    driver: Mapped["Driver"] = relationship(  # noqa: F821
        "Driver", back_populates="simulation_results", lazy="select"
    )

    def __repr__(self) -> str:
        return (
            f"<SimulationResult run={self.run_id} driver={self.driver_id} "
            f"wdc_prob={self.wdc_probability:.4f}>"
        )
