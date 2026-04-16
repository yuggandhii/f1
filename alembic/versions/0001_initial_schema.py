"""Initial schema — all tables

Revision ID: 0001
Revises:
Create Date: 2026-04-16
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # teams
    # ------------------------------------------------------------------
    op.create_table(
        "teams",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("constructor_name", sa.String(), nullable=True),
        sa.Column("power_unit", sa.String(), nullable=True),
        sa.Column("base_performance", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # drivers
    # ------------------------------------------------------------------
    op.create_table(
        "drivers",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("abbreviation", sa.String(3), nullable=True),
        sa.Column("team_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("nationality", sa.String(), nullable=True),
        sa.Column("active", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["team_id"], ["teams.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_drivers_team_id", "drivers", ["team_id"])

    # ------------------------------------------------------------------
    # circuits
    # ------------------------------------------------------------------
    op.create_table(
        "circuits",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("country", sa.String(), nullable=True),
        sa.Column("track_type", sa.String(), nullable=True),
        sa.Column("lap_count", sa.Integer(), nullable=True),
        sa.Column("overtake_difficulty", sa.Float(), nullable=True),
        sa.Column("weather_variability", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # race_results
    # ------------------------------------------------------------------
    op.create_table(
        "race_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("circuit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("grid_position", sa.Integer(), nullable=True),
        sa.Column("finish_position", sa.Integer(), nullable=True),
        sa.Column("points", sa.Float(), nullable=True),
        sa.Column("dnf", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("dnf_cause", sa.String(), nullable=True),
        sa.Column("fastest_lap", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("weather", sa.String(), nullable=True),
        sa.Column("race_time_seconds", sa.Float(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["circuit_id"], ["circuits.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_race_results_driver_id", "race_results", ["driver_id"])
    op.create_index("ix_race_results_circuit_id", "race_results", ["circuit_id"])
    op.create_index("ix_race_results_season", "race_results", ["season"])

    # ------------------------------------------------------------------
    # driver_ratings
    # ------------------------------------------------------------------
    op.create_table(
        "driver_ratings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("base_pace", sa.Float(), nullable=True),
        sa.Column("consistency", sa.Float(), nullable=True),
        sa.Column("wet_skill", sa.Float(), nullable=True),
        sa.Column("tyre_management", sa.Float(), nullable=True),
        sa.Column("overtake_skill", sa.Float(), nullable=True),
        sa.Column("dnf_rate", sa.Float(), nullable=True),
        sa.Column("qualifying_edge", sa.Float(), nullable=True),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("driver_id", "season", name="uq_driver_rating_driver_season"),
    )
    op.create_index("ix_driver_ratings_driver_id", "driver_ratings", ["driver_id"])

    # ------------------------------------------------------------------
    # simulation_runs
    # ------------------------------------------------------------------
    op.create_table(
        "simulation_runs",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("n_simulations", sa.Integer(), nullable=False),
        sa.Column("randomness_factor", sa.Float(), nullable=False),
        sa.Column("scenario", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("status", sa.String(), nullable=False, server_default="pending"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("result_path", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )

    # ------------------------------------------------------------------
    # simulation_results
    # ------------------------------------------------------------------
    op.create_table(
        "simulation_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("run_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("driver_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("wdc_probability", sa.Float(), nullable=True),
        sa.Column("expected_points", sa.Float(), nullable=True),
        sa.Column("points_std", sa.Float(), nullable=True),
        sa.Column("p1_count", sa.Integer(), nullable=True),
        sa.Column("podium_rate", sa.Float(), nullable=True),
        sa.Column("dnf_rate_simulated", sa.Float(), nullable=True),
        sa.Column(
            "per_race_win_probs",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.ForeignKeyConstraint(["driver_id"], ["drivers.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["run_id"], ["simulation_runs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_simulation_results_run_id", "simulation_results", ["run_id"])
    op.create_index("ix_simulation_results_driver_id", "simulation_results", ["driver_id"])


def downgrade() -> None:
    op.drop_table("simulation_results")
    op.drop_table("simulation_runs")
    op.drop_table("driver_ratings")
    op.drop_table("race_results")
    op.drop_table("circuits")
    op.drop_table("drivers")
    op.drop_table("teams")
