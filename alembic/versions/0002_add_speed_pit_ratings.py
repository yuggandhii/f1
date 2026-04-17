"""Add speed_rating and pit_efficiency columns to driver_ratings

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-17
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("driver_ratings", sa.Column("speed_rating", sa.Float(), nullable=True))
    op.add_column("driver_ratings", sa.Column("pit_efficiency", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("driver_ratings", "pit_efficiency")
    op.drop_column("driver_ratings", "speed_rating")
