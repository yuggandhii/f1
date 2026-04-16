"""
app/ingestion/tasks.py — Celery ingestion tasks.

Task names follow the convention: f1sim.ingestion.{verb}

fetch_season(season):
    1. Pull all Ergast data (races, results, qualifying).
    2. Pull FastF1 lap data per round.
    3. Upsert teams, circuits, drivers, race_results to DB.
    4. Trigger driver-ratings refresh.

refresh_driver_ratings(season):
    1. Load cached Parquet files for the season.
    2. Run transformers.compute_driver_ratings.
    3. Upsert driver_ratings table.
"""
from __future__ import annotations

import logging
import uuid
from contextlib import contextmanager
from typing import Generator

from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.database import SyncSessionLocal
from app.models.circuit import Circuit
from app.models.driver import Driver
from app.models.driver_rating import DriverRating as DriverRatingModel
from app.models.race_result import RaceResult
from app.models.team import Team
from app.worker import celery_app

from .ergast_client import (
    CIRCUIT_OVERTAKE_DIFFICULTY,
    fetch_season_qualifying,
    fetch_season_races,
    fetch_season_results,
)
from .fastf1_client import fetch_race_weather, fetch_season_laps
from .transformers import compute_driver_ratings

_log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# DB session helper
# ---------------------------------------------------------------------------


@contextmanager
def _db() -> Generator[Session, None, None]:
    """Yield a sync DB session; commit on success, rollback on error."""
    session: Session = SyncSessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Upsert helpers
# ---------------------------------------------------------------------------


def _upsert_teams(session: Session, results_df) -> dict[str, uuid.UUID]:
    """
    Insert or update teams from Ergast constructor data.
    Returns: dict mapping ergast constructor_id → DB UUID.
    """
    constructors = (
        results_df[["constructor_id", "constructor_name"]]
        .drop_duplicates("constructor_id")
        .itertuples(index=False)
    )
    mapping: dict[str, uuid.UUID] = {}
    for row in constructors:
        existing = (
            session.query(Team)
            .filter_by(constructor_name=row.constructor_id)
            .first()
        )
        if existing:
            mapping[row.constructor_id] = existing.id
        else:
            team = Team(
                id=uuid.uuid4(),
                name=row.constructor_name,
                constructor_name=row.constructor_id,
            )
            session.add(team)
            mapping[row.constructor_id] = team.id
    session.flush()
    return mapping


def _upsert_circuits(session: Session, races_df) -> dict[str, uuid.UUID]:
    """
    Insert or update circuits.
    Returns: dict mapping circuit_ref → DB UUID.
    """
    mapping: dict[str, uuid.UUID] = {}
    for row in races_df.drop_duplicates("circuit_ref").itertuples(index=False):
        existing = (
            session.query(Circuit)
            .filter_by(name=row.circuit_name)
            .first()
        )
        if existing:
            mapping[row.circuit_ref] = existing.id
        else:
            circuit = Circuit(
                id=uuid.uuid4(),
                name=row.circuit_name,
                country=row.country,
                track_type=row.track_type,
                lap_count=row.lap_count,
                overtake_difficulty=row.overtake_difficulty,
                weather_variability=row.weather_variability,
            )
            session.add(circuit)
            mapping[row.circuit_ref] = circuit.id
    session.flush()
    return mapping


def _upsert_drivers(
    session: Session,
    results_df,
    team_map: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    """
    Insert or update drivers.
    Returns: dict mapping ergast driver_id → DB UUID.
    """
    driver_info = (
        results_df[
            ["driver_id", "driver_name", "driver_abbr", "driver_nationality", "constructor_id"]
        ]
        .sort_values("driver_id")
        .drop_duplicates("driver_id")
    )
    mapping: dict[str, uuid.UUID] = {}
    for row in driver_info.itertuples(index=False):
        existing = (
            session.query(Driver)
            .filter_by(abbreviation=row.driver_abbr)
            .first()
        ) if row.driver_abbr else None

        if existing is None:
            existing = session.query(Driver).filter_by(name=row.driver_name).first()

        team_id = team_map.get(row.constructor_id)
        if existing:
            if team_id:
                existing.team_id = team_id
            mapping[row.driver_id] = existing.id
        else:
            driver = Driver(
                id=uuid.uuid4(),
                name=row.driver_name,
                abbreviation=row.driver_abbr[:3] if row.driver_abbr else None,
                nationality=row.driver_nationality,
                team_id=team_id,
                active=True,
            )
            session.add(driver)
            mapping[row.driver_id] = driver.id
    session.flush()
    return mapping


def _upsert_race_results(
    session: Session,
    results_df,
    driver_map: dict[str, uuid.UUID],
    circuit_map: dict[str, uuid.UUID],
    races_df,
    weather_by_round: dict[int, str],
) -> int:
    """Bulk-insert race results, skipping already-existing records."""
    # Build a round → circuit_ref map.
    round_to_circuit = dict(zip(races_df["round"], races_df["circuit_ref"]))

    inserted = 0
    for row in results_df.itertuples(index=False):
        driver_db_id = driver_map.get(row.driver_id)
        circuit_ref = round_to_circuit.get(row.round)
        circuit_db_id = circuit_map.get(circuit_ref) if circuit_ref else None

        if not driver_db_id or not circuit_db_id:
            _log.debug("Skipping result — missing driver or circuit mapping")
            continue

        # Skip if already in DB.
        existing = (
            session.query(RaceResult)
            .filter_by(
                driver_id=driver_db_id,
                circuit_id=circuit_db_id,
                season=row.season,
                round=row.round,
            )
            .first()
        )
        if existing:
            continue

        race_time_s = None
        if hasattr(row, "race_time_ms") and row.race_time_ms:
            race_time_s = row.race_time_ms / 1000.0

        rr = RaceResult(
            id=uuid.uuid4(),
            driver_id=driver_db_id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
            grid_position=int(row.grid) if row.grid else None,
            finish_position=int(row.position) if row.position else None,
            points=float(row.points),
            dnf=bool(row.dnf),
            dnf_cause=row.dnf_cause if row.dnf_cause else None,
            fastest_lap=bool(row.fastest_lap),
            weather=weather_by_round.get(int(row.round), "dry"),
            race_time_seconds=race_time_s,
        )
        session.add(rr)
        inserted += 1

    session.flush()
    return inserted


# ---------------------------------------------------------------------------
# Celery tasks
# ---------------------------------------------------------------------------


@celery_app.task(name="f1sim.ingestion.fetch_season", bind=True)
def fetch_season(self, season: int | str) -> dict:
    """
    Fetch and persist a full season of data.

    Steps:
      1. Fetch Ergast races, results, qualifying.
      2. Fetch FastF1 lap + weather data per round.
      3. Upsert teams, circuits, drivers, race_results.
      4. Trigger driver ratings refresh.
    """
    if season == "current":
        import datetime
        season = datetime.date.today().year

    season = int(season)
    _log.info("fetch_season starting: season=%d", season)

    # ── Ergast data ──────────────────────────────────────────────────────────
    try:
        races_df = fetch_season_races(season)
        results_df = fetch_season_results(season)
        _fetch_season_qualifying = fetch_season_qualifying  # noqa: for clarity
        qualifying_df = fetch_season_qualifying(season)
    except Exception as exc:
        _log.exception("Ergast fetch failed for season %d: %s", season, exc)
        return {"status": "failed", "season": season, "error": str(exc)}

    if results_df.empty:
        _log.warning("No results found for season %d — season may be in future", season)
        return {"status": "no_data", "season": season}

    # ── FastF1 data ───────────────────────────────────────────────────────────
    round_numbers: list[int] = races_df["round"].tolist()
    laps_by_round = fetch_season_laps(season, round_numbers)
    weather_by_round: dict[int, str] = {}
    for rnd in round_numbers:
        try:
            weather_by_round[rnd] = fetch_race_weather(season, rnd)
        except Exception as exc:
            _log.warning("Weather fetch failed for %d/%d: %s", season, rnd, exc)
            weather_by_round[rnd] = "dry"

    # ── Persist to DB ─────────────────────────────────────────────────────────
    with _db() as session:
        team_map = _upsert_teams(session, results_df)
        circuit_map = _upsert_circuits(session, races_df)

        # Merge circuit_ref into results_df for overtake_skill computation later.
        round_circuit = races_df[["round", "circuit_ref"]].set_index("round")["circuit_ref"]
        results_df = results_df.copy()
        results_df["circuit_ref"] = results_df["round"].map(round_circuit)

        driver_map = _upsert_drivers(session, results_df, team_map)
        inserted = _upsert_race_results(
            session, results_df, driver_map, circuit_map, races_df, weather_by_round
        )

    _log.info(
        "fetch_season done: season=%d teams=%d circuits=%d drivers=%d results_inserted=%d",
        season,
        len(team_map),
        len(circuit_map),
        len(driver_map),
        inserted,
    )

    # ── Trigger ratings refresh ───────────────────────────────────────────────
    # When called via Celery, enqueue a separate task.  When called directly
    # (e.g. seed_db.py), this may fail if no broker is running — that is OK
    # because seed_db.py calls refresh_driver_ratings() directly afterwards.
    try:
        refresh_driver_ratings.delay(season)
    except Exception as exc:
        _log.debug("Could not enqueue refresh_driver_ratings (no broker?): %s", exc)

    return {
        "status": "done",
        "season": season,
        "teams": len(team_map),
        "circuits": len(circuit_map),
        "drivers": len(driver_map),
        "results_inserted": inserted,
    }


@celery_app.task(name="f1sim.ingestion.refresh_driver_ratings", bind=True)
def refresh_driver_ratings(self, season: int) -> dict:
    """
    Recompute and upsert driver_ratings for a season.

    Reads from cached Parquet files (Ergast + FastF1).
    Falls back gracefully if FastF1 data is unavailable.
    """
    season = int(season)
    _log.info("refresh_driver_ratings: season=%d", season)

    # ── Load cached data ──────────────────────────────────────────────────────
    try:
        results_df = fetch_season_results(season)
        races_df = fetch_season_races(season)
    except Exception as exc:
        _log.exception("Cache read failed for season %d: %s", season, exc)
        return {"status": "failed", "season": season, "error": str(exc)}

    if results_df.empty:
        return {"status": "no_data", "season": season}

    round_numbers: list[int] = races_df["round"].tolist()
    laps_by_round = fetch_season_laps(season, round_numbers)
    weather_by_round: dict[int, str] = {}
    for rnd in round_numbers:
        weather_by_round[rnd] = fetch_race_weather(season, rnd)

    # Add circuit_ref to results_df for overtake_skill calculation.
    round_circuit = races_df[["round", "circuit_ref"]].set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_circuit)

    # ── Load prior seasons for weighted DNF rate ──────────────────────────────
    prior_results: dict[int, "pd.DataFrame"] = {}
    for prior_season in [season - 1, season - 2]:
        if prior_season < 2018:
            continue
        try:
            prior_df = fetch_season_results(prior_season)
            if not prior_df.empty:
                prior_results[prior_season] = prior_df
        except Exception:
            pass

    # ── Compute ratings ────────────────────────────────────────────────────────
    overtake_difficulty = dict(
        zip(races_df["circuit_ref"], races_df["overtake_difficulty"])
    )
    ratings = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round=laps_by_round,
        weather_by_round=weather_by_round,
        overtake_difficulty=overtake_difficulty,
        prior_results=prior_results if prior_results else None,
    )

    # ── Upsert to DB ──────────────────────────────────────────────────────────
    # We need the ergast_driver_id → DB UUID mapping.
    with _db() as session:
        upserted = 0
        for rating in ratings:
            driver_db = (
                session.query(Driver)
                .filter(Driver.name.isnot(None))
                .all()
            )
            # Find DB driver by matching ergast driverId against driver name/abbr.
            # We stored the ergast driverId nowhere in the Driver table, so we match
            # via abbreviation or a normalised name lookup built during fetch_season.
            # The most reliable approach: re-derive from results_df.
            driver_rows = results_df[results_df["driver_id"] == rating.driver_id]
            if driver_rows.empty:
                continue
            abbr = driver_rows.iloc[0]["driver_abbr"]
            name = driver_rows.iloc[0]["driver_name"]

            db_driver = None
            if abbr:
                db_driver = session.query(Driver).filter_by(abbreviation=abbr).first()
            if db_driver is None:
                db_driver = session.query(Driver).filter_by(name=name).first()

            if db_driver is None:
                _log.warning("Driver not found in DB: %s (%s)", name, abbr)
                continue

            # Upsert driver_rating (update if exists, insert if not).
            existing_rating = (
                session.query(DriverRatingModel)
                .filter_by(driver_id=db_driver.id, season=season)
                .first()
            )
            if existing_rating:
                existing_rating.base_pace = rating.base_pace
                existing_rating.consistency = rating.consistency
                existing_rating.wet_skill = rating.wet_skill
                existing_rating.tyre_management = rating.tyre_management
                existing_rating.overtake_skill = rating.overtake_skill
                existing_rating.dnf_rate = rating.dnf_rate
                existing_rating.qualifying_edge = rating.qualifying_edge
            else:
                session.add(DriverRatingModel(
                    id=uuid.uuid4(),
                    driver_id=db_driver.id,
                    season=season,
                    base_pace=rating.base_pace,
                    consistency=rating.consistency,
                    wet_skill=rating.wet_skill,
                    tyre_management=rating.tyre_management,
                    overtake_skill=rating.overtake_skill,
                    dnf_rate=rating.dnf_rate,
                    qualifying_edge=rating.qualifying_edge,
                ))
            upserted += 1

    _log.info("refresh_driver_ratings done: season=%d upserted=%d", season, upserted)
    return {"status": "done", "season": season, "ratings_upserted": upserted}
