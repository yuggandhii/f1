"""app/models/game_pick.py — Stand-alone game picks ORM model.

Completely independent of all other tables (no foreign keys).
Used only by the /api/v1/game routes.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Integer, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class GamePick(Base):
    __tablename__ = "game_picks"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Who made the pick
    player_name: Mapped[str] = mapped_column(String(80), nullable=False)

    # Which race this pick is for
    race_name: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    season: Mapped[int] = mapped_column(Integer, nullable=False)
    round: Mapped[int] = mapped_column(Integer, nullable=False)

    # The 5 picks — stored as driver abbreviations (e.g. "NOR", "VER")
    pick_1: Mapped[str | None] = mapped_column(String(6), nullable=True)
    pick_2: Mapped[str | None] = mapped_column(String(6), nullable=True)
    pick_3: Mapped[str | None] = mapped_column(String(6), nullable=True)
    pick_4: Mapped[str | None] = mapped_column(String(6), nullable=True)
    pick_5: Mapped[str | None] = mapped_column(String(6), nullable=True)

    # Score — NULL until the race result is known and scored
    score: Mapped[int | None] = mapped_column(Integer, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    def __repr__(self) -> str:
        picks = [self.pick_1, self.pick_2, self.pick_3, self.pick_4, self.pick_5]
        return (
            f"<GamePick player={self.player_name!r} race={self.race_name!r} "
            f"picks={picks} score={self.score}>"
        )
