"""Create game_picks table

Stand-alone table for the F1 Predictor Game feature.
No foreign keys to any other table — completely independent.

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-20
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "game_picks",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
        ),
        sa.Column("player_name", sa.String(length=80), nullable=False),
        sa.Column("race_name", sa.String(length=120), nullable=False),
        sa.Column("season", sa.Integer(), nullable=False),
        sa.Column("round", sa.Integer(), nullable=False),
        sa.Column("pick_1", sa.String(length=6), nullable=True),
        sa.Column("pick_2", sa.String(length=6), nullable=True),
        sa.Column("pick_3", sa.String(length=6), nullable=True),
        sa.Column("pick_4", sa.String(length=6), nullable=True),
        sa.Column("pick_5", sa.String(length=6), nullable=True),
        sa.Column("score", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.create_index(
        "ix_game_picks_race_name",
        "game_picks",
        ["race_name"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_game_picks_race_name", table_name="game_picks")
    op.drop_table("game_picks")
