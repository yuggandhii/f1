"""Create race_weather_forecasts table

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "race_weather_forecasts",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("circuit_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("race_date", sa.Date(), nullable=False),
        sa.Column("precipitation_probability", sa.Float(), nullable=True),
        sa.Column("predicted_condition", sa.String(), nullable=True),
        sa.Column(
            "fetched_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["circuit_id"], ["circuits.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("circuit_id", "race_date", name="uq_weather_circuit_date"),
    )
    op.create_index(
        "ix_race_weather_forecasts_circuit_id",
        "race_weather_forecasts",
        ["circuit_id"],
    )
    op.create_index(
        "ix_race_weather_forecasts_race_date",
        "race_weather_forecasts",
        ["race_date"],
    )


def downgrade() -> None:
    op.drop_table("race_weather_forecasts")
