"""
scripts/seed_db.py — Standalone DB seed script. No Celery broker required.

Fetches season data from Ergast API, optionally enriches with FastF1 lap data,
inserts all records into PostgreSQL, then computes and inserts driver_ratings.

Usage:
    python scripts/seed_db.py                         # seed 2024 only (fast)
    python scripts/seed_db.py --seasons 2022 2023 2024
    python scripts/seed_db.py --seasons 2018 2019 2020 2021 2022 2023 2024
    python scripts/seed_db.py --skip-fastf1           # Ergast-only, skip lap data
    python scripts/seed_db.py --verify-only           # print row counts, exit

Prerequisites:
    docker compose up -d      # postgres must be running
    alembic upgrade head      # tables must exist
"""
from __future__ import annotations

import argparse
import logging
import sys
import uuid
from pathlib import Path

# Make sure the project root is importable when run as a script.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import SyncSessionLocal
from app.ingestion.ergast_client import (
    CIRCUIT_OVERTAKE_DIFFICULTY,
    fetch_season_qualifying,
    fetch_season_races,
    fetch_season_results,
)
from app.ingestion.fastf1_client import fetch_race_weather, fetch_season_laps
from app.ingestion.transformers import DriverRating, compute_driver_ratings
from app.models.circuit import Circuit
from app.models.driver import Driver
from app.models.driver_rating import DriverRating as DriverRatingModel
from app.models.race_result import RaceResult
from app.models.team import Team

# ---------------------------------------------------------------------------
# Logging setup
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("seed_db")


# ---------------------------------------------------------------------------
# DB upsert helpers  (all accept an open Session, call session.flush() inside)
# ---------------------------------------------------------------------------


def _upsert_teams(
    session: Session, results_df: pd.DataFrame
) -> dict[str, uuid.UUID]:
    """
    Ensure every constructor from results_df exists in the teams table.
    Returns: ergast constructor_id  →  DB UUID
    """
    constructors = (
        results_df[["constructor_id", "constructor_name"]]
        .drop_duplicates("constructor_id")
    )
    mapping: dict[str, uuid.UUID] = {}

    for row in constructors.itertuples(index=False):
        existing = (
            session.query(Team)
            .filter_by(constructor_name=row.constructor_id)
            .first()
        )
        if existing:
            mapping[row.constructor_id] = existing.id
            _log.debug("Team already exists: %s", row.constructor_name)
        else:
            team = Team(
                id=uuid.uuid4(),
                name=row.constructor_name,
                constructor_name=row.constructor_id,  # ergast slug stored here
            )
            session.add(team)
            mapping[row.constructor_id] = team.id
            _log.debug("Inserted team: %s", row.constructor_name)

    session.flush()
    return mapping


def _upsert_circuits(
    session: Session, races_df: pd.DataFrame
) -> dict[str, uuid.UUID]:
    """
    Ensure every circuit from the season calendar exists in the circuits table.
    Returns: circuit_ref  →  DB UUID
    """
    unique_circuits = races_df.drop_duplicates("circuit_ref")
    mapping: dict[str, uuid.UUID] = {}

    for row in unique_circuits.itertuples(index=False):
        existing = (
            session.query(Circuit)
            .filter_by(name=row.circuit_name)
            .first()
        )
        if existing:
            # Keep static metadata fresh on re-runs.
            existing.country = row.country
            existing.track_type = row.track_type
            existing.lap_count = int(row.lap_count)
            existing.overtake_difficulty = float(row.overtake_difficulty)
            existing.weather_variability = float(row.weather_variability)
            mapping[row.circuit_ref] = existing.id
            _log.debug("Updated circuit: %s", row.circuit_name)
        else:
            circuit = Circuit(
                id=uuid.uuid4(),
                name=row.circuit_name,
                country=row.country,
                track_type=row.track_type,
                lap_count=int(row.lap_count),
                overtake_difficulty=float(row.overtake_difficulty),
                weather_variability=float(row.weather_variability),
            )
            session.add(circuit)
            mapping[row.circuit_ref] = circuit.id
            _log.debug("Inserted circuit: %s", row.circuit_name)

    session.flush()
    return mapping


def _upsert_drivers(
    session: Session,
    results_df: pd.DataFrame,
    team_map: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    """
    Ensure every driver from results_df exists in the drivers table.
    Returns: ergast driver_id  →  DB UUID
    """
    driver_info = (
        results_df[
            ["driver_id", "driver_name", "driver_abbr",
             "driver_nationality", "constructor_id"]
        ]
        .drop_duplicates("driver_id")
    )
    mapping: dict[str, uuid.UUID] = {}

    for row in driver_info.itertuples(index=False):
        abbr = str(row.driver_abbr).strip().upper()[:3] if row.driver_abbr else None

        # Lookup: try abbreviation first (most stable), then full name.
        existing: Driver | None = None
        if abbr:
            existing = session.query(Driver).filter_by(abbreviation=abbr).first()
        if existing is None:
            existing = session.query(Driver).filter_by(name=row.driver_name).first()

        team_id = team_map.get(row.constructor_id)

        if existing:
            # Update team assignment in case driver switched teams.
            if team_id:
                existing.team_id = team_id
            existing.active = True
            mapping[row.driver_id] = existing.id
            _log.debug("Updated driver: %s", row.driver_name)
        else:
            driver = Driver(
                id=uuid.uuid4(),
                name=row.driver_name,
                abbreviation=abbr,
                nationality=row.driver_nationality or None,
                team_id=team_id,
                active=True,
            )
            session.add(driver)
            mapping[row.driver_id] = driver.id
            _log.debug("Inserted driver: %s", row.driver_name)

    session.flush()
    return mapping


def _upsert_race_results(
    session: Session,
    results_df: pd.DataFrame,
    driver_map: dict[str, uuid.UUID],
    circuit_map: dict[str, uuid.UUID],
    races_df: pd.DataFrame,
    weather_by_round: dict[int, str],
) -> int:
    """
    Insert race results that are not already in the DB.
    Returns the number of rows inserted.
    """
    round_to_circuit = dict(zip(races_df["round"], races_df["circuit_ref"]))
    inserted = 0

    for row in results_df.itertuples(index=False):
        driver_db_id = driver_map.get(row.driver_id)
        circuit_ref = round_to_circuit.get(int(row.round))
        circuit_db_id = circuit_map.get(circuit_ref) if circuit_ref else None

        if not driver_db_id or not circuit_db_id:
            _log.debug(
                "Skipping result — unmapped driver=%s circuit_ref=%s",
                row.driver_id, circuit_ref,
            )
            continue

        already_exists = (
            session.query(RaceResult)
            .filter_by(
                driver_id=driver_db_id,
                circuit_id=circuit_db_id,
                season=int(row.season),
                round=int(row.round),
            )
            .first()
        )
        if already_exists:
            continue

        race_time_s: float | None = None
        race_time_ms = getattr(row, "race_time_ms", None)
        if race_time_ms:
            race_time_s = float(race_time_ms) / 1000.0

        session.add(RaceResult(
            id=uuid.uuid4(),
            driver_id=driver_db_id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
            grid_position=int(row.grid) if row.grid else None,
            finish_position=int(row.position) if row.position else None,
            points=float(row.points),
            dnf=bool(row.dnf),
            dnf_cause=row.dnf_cause if pd.notna(row.dnf_cause) else None,
            fastest_lap=bool(row.fastest_lap),
            weather=weather_by_round.get(int(row.round), "dry"),
            race_time_seconds=race_time_s,
        ))
        inserted += 1

    session.flush()
    return inserted


def _upsert_driver_ratings(
    session: Session,
    ratings: list[DriverRating],
    results_df: pd.DataFrame,
) -> int:
    """
    Insert or update driver_ratings rows.
    Returns number of rows upserted.
    """
    # Build ergast_driver_id → (name, abbr) for DB lookup.
    driver_meta = (
        results_df[["driver_id", "driver_name", "driver_abbr"]]
        .drop_duplicates("driver_id")
        .set_index("driver_id")
    )

    upserted = 0
    for rating in ratings:
        meta = driver_meta.loc[rating.driver_id] if rating.driver_id in driver_meta.index else None
        if meta is None:
            _log.warning("No metadata for driver %s — skipping rating", rating.driver_id)
            continue

        abbr = str(meta["driver_abbr"]).strip().upper()[:3] if meta["driver_abbr"] else None
        name = str(meta["driver_name"])

        db_driver: Driver | None = None
        if abbr:
            db_driver = session.query(Driver).filter_by(abbreviation=abbr).first()
        if db_driver is None:
            db_driver = session.query(Driver).filter_by(name=name).first()

        if db_driver is None:
            _log.warning("Driver not in DB: %s (%s) — skipping rating", name, abbr)
            continue

        existing = (
            session.query(DriverRatingModel)
            .filter_by(driver_id=db_driver.id, season=rating.season)
            .first()
        )
        if existing:
            existing.base_pace = rating.base_pace
            existing.consistency = rating.consistency
            existing.wet_skill = rating.wet_skill
            existing.tyre_management = rating.tyre_management
            existing.overtake_skill = rating.overtake_skill
            existing.dnf_rate = rating.dnf_rate
            existing.qualifying_edge = rating.qualifying_edge
        else:
            session.add(DriverRatingModel(
                id=uuid.uuid4(),
                driver_id=db_driver.id,
                season=rating.season,
                base_pace=rating.base_pace,
                consistency=rating.consistency,
                wet_skill=rating.wet_skill,
                tyre_management=rating.tyre_management,
                overtake_skill=rating.overtake_skill,
                dnf_rate=rating.dnf_rate,
                qualifying_edge=rating.qualifying_edge,
            ))
        upserted += 1

    session.flush()
    return upserted


# ---------------------------------------------------------------------------
# Per-season pipeline
# ---------------------------------------------------------------------------


def seed_season(season: int, skip_fastf1: bool = False) -> dict:
    """
    Full ingestion + ratings pipeline for one season.
    Returns a summary dict.
    """
    _log.info("── Season %d ─────────────────────────────────────────", season)

    # ── 1. Fetch Ergast data ────────────────────────────────────────────────
    _log.info("[%d] Fetching race calendar from Ergast...", season)
    races_df = fetch_season_races(season)
    if races_df.empty:
        _log.warning("[%d] No races found (future season?), skipping.", season)
        return {"season": season, "status": "no_data"}

    _log.info("[%d] Fetching race results from Ergast...", season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        _log.warning("[%d] No results yet (season not started?), skipping.", season)
        return {"season": season, "status": "no_data"}

    # Attach circuit_ref to results so transformers can use overtake_difficulty.
    round_to_circuit_ref = races_df.set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_to_circuit_ref)

    _log.info(
        "[%d] Ergast: %d rounds, %d results, %d unique drivers",
        season, len(races_df), len(results_df), results_df["driver_id"].nunique(),
    )

    # ── 2. Fetch FastF1 lap + weather data ──────────────────────────────────
    round_numbers: list[int] = sorted(races_df["round"].tolist())
    laps_by_round: dict[int, pd.DataFrame] = {}
    weather_by_round: dict[int, str] = {}

    if skip_fastf1:
        _log.info("[%d] Skipping FastF1 lap data (--skip-fastf1)", season)
        weather_by_round = {rnd: "dry" for rnd in round_numbers}
    else:
        _log.info("[%d] Fetching FastF1 lap data for %d rounds...", season, len(round_numbers))
        laps_by_round = fetch_season_laps(season, round_numbers)
        total_laps = sum(len(df) for df in laps_by_round.values())
        _log.info("[%d] FastF1: %d total lap rows fetched", season, total_laps)

        for rnd in round_numbers:
            weather_by_round[rnd] = fetch_race_weather(season, rnd)

    # ── 3. Persist teams, circuits, drivers, race results ───────────────────
    _log.info("[%d] Upserting teams, circuits, drivers, race results...", season)
    with SyncSessionLocal() as session:
        team_map = _upsert_teams(session, results_df)
        circuit_map = _upsert_circuits(session, races_df)
        driver_map = _upsert_drivers(session, results_df, team_map)
        results_inserted = _upsert_race_results(
            session, results_df, driver_map, circuit_map, races_df, weather_by_round
        )
        session.commit()

    _log.info(
        "[%d] DB: %d teams, %d circuits, %d drivers, %d results inserted",
        season, len(team_map), len(circuit_map), len(driver_map), results_inserted,
    )

    # ── 4. Compute driver ratings ────────────────────────────────────────────
    _log.info("[%d] Computing driver ratings...", season)

    # Load prior 2 seasons for weighted DNF rate (from Ergast cache).
    prior_results: dict[int, pd.DataFrame] = {}
    for prior in [season - 1, season - 2]:
        if prior < 2018:
            continue
        try:
            prior_df = fetch_season_results(prior)
            if not prior_df.empty:
                prior_results[prior] = prior_df
                _log.debug("[%d] Loaded prior season %d for DNF weighting", season, prior)
        except Exception as exc:
            _log.debug("[%d] Could not load prior season %d: %s", season, prior, exc)

    overtake_difficulty = dict(
        zip(races_df["circuit_ref"], races_df["overtake_difficulty"])
    )

    ratings = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round=laps_by_round,
        weather_by_round=weather_by_round,
        overtake_difficulty=overtake_difficulty,
        prior_results=prior_results or None,
    )

    # ── 5. Persist driver ratings ────────────────────────────────────────────
    with SyncSessionLocal() as session:
        ratings_upserted = _upsert_driver_ratings(session, ratings, results_df)
        session.commit()

    _log.info(
        "[%d] Driver ratings upserted: %d / %d drivers",
        season, ratings_upserted, len(ratings),
    )

    return {
        "season": season,
        "status": "done",
        "teams": len(team_map),
        "circuits": len(circuit_map),
        "drivers": len(driver_map),
        "results_inserted": results_inserted,
        "ratings_upserted": ratings_upserted,
    }


# ---------------------------------------------------------------------------
# Verification
# ---------------------------------------------------------------------------


def verify_db() -> bool:
    """
    Print row counts for all key tables and check minimum requirements.
    Returns True if all checks pass.
    """
    with SyncSessionLocal() as session:
        counts = {
            "teams":          session.query(func.count(Team.id)).scalar(),
            "circuits":       session.query(func.count(Circuit.id)).scalar(),
            "drivers":        session.query(func.count(Driver.id)).scalar(),
            "race_results":   session.query(func.count(RaceResult.id)).scalar(),
            "driver_ratings": session.query(func.count(DriverRatingModel.id)).scalar(),
        }

    _log.info("─" * 52)
    _log.info("DB row counts after seed:")
    for table, count in counts.items():
        _log.info("  %-20s  %d", table, count)
    _log.info("─" * 52)

    checks = [
        (counts["drivers"] >= 20,        f"drivers >= 20 (got {counts['drivers']})"),
        (counts["driver_ratings"] >= 20,  f"driver_ratings >= 20 (got {counts['driver_ratings']})"),
        (counts["circuits"] >= 20,        f"circuits >= 20 (got {counts['circuits']})"),
        (counts["race_results"] > 0,      f"race_results > 0 (got {counts['race_results']})"),
    ]

    ok = True
    for passed, msg in checks:
        if passed:
            _log.info("PASS  %s", msg)
        else:
            _log.error("FAIL  %s", msg)
            ok = False

    return ok


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Seed the F1 simulator database from Ergast API"
    )
    p.add_argument(
        "--seasons",
        nargs="+",
        type=int,
        default=[2024],
        metavar="YEAR",
        help="Seasons to ingest (default: 2024)",
    )
    p.add_argument(
        "--skip-fastf1",
        action="store_true",
        help="Skip FastF1 lap data — uses Ergast-only ratings (faster, less accurate)",
    )
    p.add_argument(
        "--verify-only",
        action="store_true",
        help="Skip ingestion; just print row counts and verify requirements",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.verify_only:
        ok = verify_db()
        sys.exit(0 if ok else 1)

    all_ok = True
    for season in args.seasons:
        try:
            result = seed_season(season, skip_fastf1=args.skip_fastf1)
            if result.get("status") not in ("done", "no_data"):
                all_ok = False
        except Exception:
            _log.exception("Unhandled error seeding season %d", season)
            all_ok = False

    ok = verify_db()
    sys.exit(0 if (all_ok and ok) else 1)
