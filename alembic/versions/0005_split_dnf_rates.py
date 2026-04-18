"""Add mechanical_dnf_rate and driver_dnf_rate to driver_ratings

Splits the existing combined dnf_rate into:
  - mechanical_dnf_rate: car-failure DNFs, team-averaged (both teammates share
      the same factory reliability burden, e.g. Ferrari engine failures 2022).
  - driver_dnf_rate: crash / driver-error DNFs, individual per driver.

dnf_rate is kept as the backwards-compatible sum of the two components.

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-18
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "driver_ratings",
        sa.Column("mechanical_dnf_rate", sa.Float(), nullable=True),
    )
    op.add_column(
        "driver_ratings",
        sa.Column("driver_dnf_rate", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("driver_ratings", "driver_dnf_rate")
    op.drop_column("driver_ratings", "mechanical_dnf_rate")
