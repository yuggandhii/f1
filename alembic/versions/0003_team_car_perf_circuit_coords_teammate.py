"""Add car_performance to teams, lat/lon + SC probs to circuits, teammate_index to driver_ratings

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # teams: car performance rating per season
    op.add_column("teams", sa.Column("car_performance", sa.Float(), nullable=True))
    op.add_column("teams", sa.Column("car_performance_season", sa.Integer(), nullable=True))
    op.add_column("teams", sa.Column("engine_supplier", sa.String(), nullable=True))

    # circuits: geographic coordinates for weather API
    op.add_column("circuits", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("circuits", sa.Column("longitude", sa.Float(), nullable=True))
    # Safety car / VSC probability derived from historical FastF1 track_status data
    op.add_column(
        "circuits",
        sa.Column("sc_probability", sa.Float(), nullable=True, server_default="0.3"),
    )
    op.add_column(
        "circuits",
        sa.Column("vsc_probability", sa.Float(), nullable=True, server_default="0.15"),
    )

    # driver_ratings: teammate comparison index (-1 to +1, positive = faster than teammate)
    op.add_column("driver_ratings", sa.Column("teammate_index", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("driver_ratings", "teammate_index")
    op.drop_column("circuits", "vsc_probability")
    op.drop_column("circuits", "sc_probability")
    op.drop_column("circuits", "longitude")
    op.drop_column("circuits", "latitude")
    op.drop_column("teams", "engine_supplier")
    op.drop_column("teams", "car_performance_season")
    op.drop_column("teams", "car_performance")
