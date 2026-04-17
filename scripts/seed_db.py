"""
scripts/seed_db.py — Standalone DB seed script. No Celery broker required.

Fetches season data from Ergast/Jolpica, enriches with FastF1 lap + telemetry +
pit stop data, inserts all records into PostgreSQL, then computes and inserts
driver_ratings (7 original + speed_rating + pit_efficiency).

Usage:
    python scripts/seed_db.py                              # seed 2024 only
    python scripts/seed_db.py --seasons 2023 2024 2025 2026
    python scripts/seed_db.py --seasons 2015 2016 2017 2018 2019 2020 2021 2022
    python scripts/seed_db.py --skip-fastf1                # Ergast-only ratings
    python scripts/seed_db.py --verify-only                # print row counts only

Prerequisites:
    docker compose up -d      # postgres must be running
    alembic upgrade head      # tables must include 0002 migration
"""
from __future__ import annotations

import argparse
import datetime
import logging
import sys
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pandas as pd
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from app.database import SyncSessionLocal
from app.ingestion.ergast_client import (
    CIRCUIT_OVERTAKE_DIFFICULTY,
    fetch_season_qualifying,
    fetch_season_races,
    fetch_season_results,
    get_completed_rounds,
)
from app.ingestion.fastf1_client import (
    fetch_race_weather,
    fetch_season_laps,
    fetch_season_pitstops,
    fetch_season_telemetry,
    try_get_cached_season_laps,
    try_get_cached_season_weather,
)
from app.ingestion.transformers import DriverRating, compute_driver_ratings
from app.models.circuit import Circuit
from app.models.driver import Driver
from app.models.driver_rating import DriverRating as DriverRatingModel
from app.models.race_result import RaceResult
from app.models.team import Team

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
_log = logging.getLogger("seed_db")

_CURRENT_YEAR = datetime.date.today().year


# ---------------------------------------------------------------------------
# DB upsert helpers
# ---------------------------------------------------------------------------


def _upsert_teams(session: Session, results_df: pd.DataFrame) -> dict[str, uuid.UUID]:
    constructors = results_df[["constructor_id", "constructor_name"]].drop_duplicates("constructor_id")
    mapping: dict[str, uuid.UUID] = {}
    for row in constructors.itertuples(index=False):
        existing = session.query(Team).filter_by(constructor_name=row.constructor_id).first()
        if existing:
            mapping[row.constructor_id] = existing.id
        else:
            team = Team(id=uuid.uuid4(), name=row.constructor_name, constructor_name=row.constructor_id)
            session.add(team)
            mapping[row.constructor_id] = team.id
    session.flush()
    return mapping


def _upsert_circuits(session: Session, races_df: pd.DataFrame) -> dict[str, uuid.UUID]:
    mapping: dict[str, uuid.UUID] = {}
    for row in races_df.drop_duplicates("circuit_ref").itertuples(index=False):
        existing = session.query(Circuit).filter_by(name=row.circuit_name).first()
        if existing:
            existing.country = row.country
            existing.track_type = row.track_type
            existing.lap_count = int(row.lap_count)
            existing.overtake_difficulty = float(row.overtake_difficulty)
            existing.weather_variability = float(row.weather_variability)
            mapping[row.circuit_ref] = existing.id
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
    session.flush()
    return mapping


def _upsert_drivers(
    session: Session,
    results_df: pd.DataFrame,
    team_map: dict[str, uuid.UUID],
) -> dict[str, uuid.UUID]:
    driver_info = (
        results_df[["driver_id", "driver_name", "driver_abbr", "driver_nationality", "constructor_id"]]
        .drop_duplicates("driver_id")
    )
    mapping: dict[str, uuid.UUID] = {}
    for row in driver_info.itertuples(index=False):
        abbr = str(row.driver_abbr).strip().upper()[:3] if row.driver_abbr else None
        existing: Driver | None = None
        if abbr:
            existing = session.query(Driver).filter_by(abbreviation=abbr).first()
        if existing is None:
            existing = session.query(Driver).filter_by(name=row.driver_name).first()

        team_id = team_map.get(row.constructor_id)
        if existing:
            if team_id:
                existing.team_id = team_id
            existing.active = True
            mapping[row.driver_id] = existing.id
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
    round_to_circuit = dict(zip(races_df["round"], races_df["circuit_ref"]))
    inserted = 0
    for row in results_df.itertuples(index=False):
        driver_db_id = driver_map.get(row.driver_id)
        circuit_ref = round_to_circuit.get(int(row.round))
        circuit_db_id = circuit_map.get(circuit_ref) if circuit_ref else None
        if not driver_db_id or not circuit_db_id:
            continue
        exists = session.query(RaceResult).filter_by(
            driver_id=driver_db_id,
            circuit_id=circuit_db_id,
            season=int(row.season),
            round=int(row.round),
        ).first()
        if exists:
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
    driver_meta = (
        results_df[["driver_id", "driver_name", "driver_abbr"]]
        .drop_duplicates("driver_id")
        .set_index("driver_id")
    )
    upserted = 0
    for rating in ratings:
        meta = driver_meta.loc[rating.driver_id] if rating.driver_id in driver_meta.index else None
        if meta is None:
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
            existing.speed_rating = rating.speed_rating
            existing.pit_efficiency = rating.pit_efficiency
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
                speed_rating=rating.speed_rating,
                pit_efficiency=rating.pit_efficiency,
            ))
        upserted += 1
    session.flush()
    return upserted


# ---------------------------------------------------------------------------
# Per-season pipeline
# ---------------------------------------------------------------------------


def seed_season(season: int, skip_fastf1: bool = False) -> dict:
    """Full ingestion + ratings pipeline for one season."""
    _log.info("── Season %d ─────────────────────────────────────────", season)

    # ── 1. Ergast / Jolpica calendar + results ──────────────────────────────
    _log.info("[%d] Fetching race calendar...", season)
    races_df = fetch_season_races(season)
    if races_df.empty:
        _log.warning("[%d] No races found — skipping.", season)
        return {"season": season, "status": "no_data"}

    _log.info("[%d] Calendar: %d rounds", season, len(races_df))

    _log.info("[%d] Fetching race results...", season)
    results_df = fetch_season_results(season)
    if results_df.empty:
        _log.warning("[%d] No results yet — skipping.", season)
        return {"season": season, "status": "no_data"}

    # Attach circuit_ref to results
    round_to_circuit_ref = races_df.set_index("round")["circuit_ref"]
    results_df = results_df.copy()
    results_df["circuit_ref"] = results_df["round"].map(round_to_circuit_ref)

    _log.info(
        "[%d] Ergast: %d rounds with results, %d result rows, %d unique drivers",
        season,
        results_df["round"].nunique(),
        len(results_df),
        results_df["driver_id"].nunique(),
    )

    _log.info("[%d] Fetching qualifying data...", season)
    try:
        fetch_season_qualifying(season)
    except Exception as exc:
        _log.warning("[%d] Qualifying fetch failed: %s", season, exc)

    # ── 2. FastF1 lap + telemetry + pitstop + weather data ──────────────────
    all_round_numbers: list[int] = sorted(races_df["round"].tolist())

    # For partial/current seasons, only fetch FastF1 for completed rounds
    if season >= _CURRENT_YEAR:
        fastf1_rounds = get_completed_rounds(season)
        if not fastf1_rounds:
            fastf1_rounds = sorted(results_df["round"].unique().tolist())
        _log.info(
            "[%d] Partial season: fetching FastF1 for %d/%d completed rounds",
            season, len(fastf1_rounds), len(all_round_numbers),
        )
    else:
        fastf1_rounds = all_round_numbers

    laps_by_round: dict[int, pd.DataFrame] = {}
    telemetry_by_round: dict[int, pd.DataFrame] = {}
    pitstops_by_round: dict[int, pd.DataFrame] = {}
    weather_by_round: dict[int, str] = {rnd: "dry" for rnd in all_round_numbers}

    if skip_fastf1:
        _log.info("[%d] Skipping FastF1 data (--skip-fastf1)", season)
    else:
        _log.info("[%d] Fetching FastF1 laps for %d rounds...", season, len(fastf1_rounds))
        laps_by_round = fetch_season_laps(season, fastf1_rounds)
        total_laps = sum(len(df) for df in laps_by_round.values())
        _log.info("[%d] FastF1 laps: %d total rows", season, total_laps)

        _log.info("[%d] Fetching telemetry (sector/speed) for %d rounds...", season, len(fastf1_rounds))
        telemetry_by_round = fetch_season_telemetry(season, fastf1_rounds)

        _log.info("[%d] Fetching pit stop data for %d rounds...", season, len(fastf1_rounds))
        pitstops_by_round = fetch_season_pitstops(season, fastf1_rounds)

        for rnd in fastf1_rounds:
            weather_by_round[rnd] = fetch_race_weather(season, rnd)

    # ── 3. Persist teams, circuits, drivers, race results ────────────────────
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

    # ── 4. Load prior seasons for multi-season wet_skill ─────────────────────
    prior_seasons_data: list = []
    prior_results: dict[int, pd.DataFrame] = {}

    if not skip_fastf1:
        for prior in [season - 1, season - 2]:
            if prior < 2015:
                continue
            try:
                cached_laps = try_get_cached_season_laps(prior)
                cached_weather = try_get_cached_season_weather(prior)
                if cached_laps:
                    prior_seasons_data.append((cached_laps, cached_weather))
                    _log.debug("[%d] Loaded %d rounds of prior-season %d laps for wet_skill", season, len(cached_laps), prior)
            except Exception as exc:
                _log.debug("[%d] Prior season %d laps unavailable: %s", season, prior, exc)

    for prior in [season - 1, season - 2]:
        if prior < 2015:
            continue
        try:
            prior_df = fetch_season_results(prior)
            if not prior_df.empty:
                prior_results[prior] = prior_df
        except Exception:
            pass

    # ── 5. Compute driver ratings ────────────────────────────────────────────
    _log.info("[%d] Computing driver ratings...", season)
    overtake_difficulty = dict(zip(races_df["circuit_ref"], races_df["overtake_difficulty"]))

    ratings = compute_driver_ratings(
        season=season,
        results_df=results_df,
        laps_by_round=laps_by_round,
        weather_by_round=weather_by_round,
        telemetry_by_round=telemetry_by_round or None,
        pitstops_by_round=pitstops_by_round or None,
        prior_seasons_data=prior_seasons_data or None,
        overtake_difficulty=overtake_difficulty,
        prior_results=prior_results or None,
    )

    # ── 6. Persist driver ratings ────────────────────────────────────────────
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
        "rounds_in_calendar": len(all_round_numbers),
        "rounds_with_results": results_df["round"].nunique(),
        "fastf1_rounds_fetched": len(fastf1_rounds),
        "total_laps": sum(len(df) for df in laps_by_round.values()),
        "teams": len(team_map),
        "circuits": len(circuit_map),
        "drivers": len(driver_map),
        "results_inserted": results_inserted,
        "ratings_upserted": ratings_upserted,
    }


# ---------------------------------------------------------------------------
# Verification + reporting
# ---------------------------------------------------------------------------


def verify_db() -> bool:
    with SyncSessionLocal() as session:
        counts = {
            "teams":          session.query(func.count(Team.id)).scalar(),
            "circuits":       session.query(func.count(Circuit.id)).scalar(),
            "drivers":        session.query(func.count(Driver.id)).scalar(),
            "race_results":   session.query(func.count(RaceResult.id)).scalar(),
            "driver_ratings": session.query(func.count(DriverRatingModel.id)).scalar(),
        }

    _log.info("─" * 60)
    _log.info("DB row counts:")
    for table, count in counts.items():
        _log.info("  %-22s  %d", table, count)
    _log.info("─" * 60)

    checks = [
        (counts["drivers"] >= 20,        f"drivers >= 20 (got {counts['drivers']})"),
        (counts["driver_ratings"] >= 20,  f"driver_ratings >= 20 (got {counts['driver_ratings']})"),
        (counts["circuits"] >= 20,        f"circuits >= 20 (got {counts['circuits']})"),
        (counts["race_results"] > 0,      f"race_results > 0 (got {counts['race_results']})"),
    ]

    ok = True
    for passed, msg in checks:
        status = "PASS" if passed else "FAIL"
        log_fn = _log.info if passed else _log.error
        log_fn("%s  %s", status, msg)
        if not passed:
            ok = False

    return ok


def print_top_ratings(season: int, top_n: int = 10) -> None:
    """Print top-N drivers by base_pace for the given season."""
    with SyncSessionLocal() as session:
        results = (
            session.query(DriverRatingModel, Driver)
            .join(Driver, DriverRatingModel.driver_id == Driver.id)
            .filter(DriverRatingModel.season == season)
            .order_by(DriverRatingModel.base_pace.desc())
            .limit(top_n)
            .all()
        )
    if not results:
        _log.info("No ratings found for season %d", season)
        return

    _log.info("── Top %d drivers by pace (season %d) ─────────────────────", top_n, season)
    _log.info(
        "  %2s  %-24s  %5s  %5s  %5s  %5s  %5s",
        "#", "Driver", "pace", "wet", "tyre", "spd", "pit",
    )
    for i, (r, d) in enumerate(results, 1):
        _log.info(
            "  %2d  %-24s  %.3f  %.3f  %.3f  %.3f  %.3f",
            i, d.name,
            r.base_pace or 0.0,
            r.wet_skill or 0.0,
            r.tyre_management or 0.0,
            r.speed_rating or 0.0,
            r.pit_efficiency or 0.0,
        )


def print_season_round_counts(summaries: list[dict]) -> None:
    """Print per-season summary table from seed results."""
    _log.info("─" * 80)
    _log.info(
        "  %-6s  %7s  %7s  %7s  %10s  %7s  %7s",
        "Season", "Cal-Rnd", "Res-Rnd", "FF1-Rnd", "Laps", "Results", "Ratings",
    )
    _log.info("─" * 80)
    for s in summaries:
        if s.get("status") == "no_data":
            _log.info("  %-6d  no data", s["season"])
        elif s.get("status") == "done":
            _log.info(
                "  %-6d  %7d  %7d  %7d  %10d  %7d  %7d",
                s["season"],
                s.get("rounds_in_calendar", 0),
                s.get("rounds_with_results", 0),
                s.get("fastf1_rounds_fetched", 0),
                s.get("total_laps", 0),
                s.get("results_inserted", 0),
                s.get("ratings_upserted", 0),
            )
        else:
            _log.info("  %-6d  %s", s["season"], s.get("status", "error"))
    _log.info("─" * 80)


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seed the F1 simulator database")
    p.add_argument(
        "--seasons", nargs="+", type=int, default=[2024], metavar="YEAR",
        help="Seasons to ingest (default: 2024)",
    )
    p.add_argument(
        "--skip-fastf1", action="store_true",
        help="Skip FastF1 data — Ergast-only ratings (faster but less accurate)",
    )
    p.add_argument(
        "--verify-only", action="store_true",
        help="Skip ingestion; print row counts and exit",
    )
    return p.parse_args()


if __name__ == "__main__":
    args = _parse_args()

    if args.verify_only:
        ok = verify_db()
        sys.exit(0 if ok else 1)

    summaries: list[dict] = []
    failed_seasons: list[int] = []

    for season in args.seasons:
        try:
            result = seed_season(season, skip_fastf1=args.skip_fastf1)
            summaries.append(result)
            if result.get("status") not in ("done", "no_data"):
                failed_seasons.append(season)
        except Exception:
            _log.exception("Unhandled error seeding season %d", season)
            summaries.append({"season": season, "status": "error"})
            failed_seasons.append(season)

    print_season_round_counts(summaries)

    ok = verify_db()

    # Show top ratings for recent/current seasons
    for season in args.seasons:
        if season >= 2024:
            print_top_ratings(season)

    if failed_seasons:
        _log.error("Failed seasons: %s", failed_seasons)

    sys.exit(0 if (ok and not failed_seasons) else 1)
